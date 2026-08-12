"""Site 360 — a facility-centric view derived from the bill register.

WWE OS bills against a **facility** (the plant/site an AMC or supply covers),
snapshotted onto every invoice. That snapshot is the only place a "site"
exists today, so this service treats the distinct facility names as the site
directory and assembles each site's picture from the invoices raised against
it: which customer(s) it belongs to, whether it is SEZ, what has been invoiced,
its AMC bills, and its recent activity from the audit trail.

Honest about the seams: employees (`location` is a coarse city, not a
facility), documents, purchases and attendance carry no facility link yet, so
they are reported as unlinked rather than guessed. Wiring those to a site is
the cross-module-relationship work (Tier 1 #8); when a site needs to be an
independently editable record with its own key, that is a deliberate migration
— this view invents no Site table.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Count, Max, Sum
from finance.backend.models.invoice import Invoice, InvoiceStatus, InvoiceType
from shared.exceptions import NotFoundError
from shared.services import BaseService

RECENT_LIMIT = 10


def _money(value: Decimal | None) -> str:
    return str((value or Decimal("0.00")).quantize(Decimal("0.01")))


class SiteDirectoryService(BaseService):
    @staticmethod
    def _scope(tenant) -> dict[str, Any]:
        """Tenant filter kwargs. `None` means untenanted (superuser / the
        single-operator setup) — no tenant filter, same as `_tenant_id` in the
        views."""
        return {} if tenant is None else {"tenant": tenant}

    def _all(self, tenant):
        return Invoice.objects.filter(**self._scope(tenant))

    def _active(self, tenant):
        return self._all(tenant).exclude(status=InvoiceStatus.CANCELLED)

    def list_sites(self, *, tenant) -> list[dict[str, Any]]:
        rows = (
            self._active(tenant)
            .exclude(facility="")
            .values("facility")
            .annotate(
                invoice_count=Count("id"),
                total_invoiced=Sum("total"),
                last_invoice_date=Max("invoice_date"),
            )
            .order_by("facility")
        )
        sites = []
        for row in rows:
            facility = row["facility"]
            sites.append(
                {
                    "name": facility,
                    "invoice_count": row["invoice_count"],
                    "total_invoiced": _money(row["total_invoiced"]),
                    "last_invoice_date": row["last_invoice_date"],
                    "customers": self._customer_names(tenant, facility),
                    "is_sez": self._is_sez(tenant, facility),
                }
            )
        return sites

    def site_overview(self, *, tenant, name: str) -> dict[str, Any]:
        name = (name or "").strip()
        at_site = self._active(tenant).filter(facility=name)
        all_at_site = self._all(tenant).filter(facility=name)
        if not name or not all_at_site.exists():
            raise NotFoundError("No site on record under that name.")

        invoiced = at_site.aggregate(total=Sum("total"))["total"]
        return {
            "name": name,
            "is_sez": self._is_sez(tenant, name),
            "customers": self._customer_names(tenant, name),
            "financials": {
                "total_invoiced": _money(invoiced),
                "invoice_count": all_at_site.count(),
                "active_count": at_site.count(),
                "amc_count": at_site.filter(invoice_type=InvoiceType.AMC).count(),
            },
            "invoices": [self._row(inv) for inv in self._recent(all_at_site)],
            "amc": [
                self._row(inv)
                for inv in self._recent(at_site.filter(invoice_type=InvoiceType.AMC))
            ],
            "activity": self._activity(tenant, all_at_site),
            # Declared unlinked so the UI states it plainly instead of faking it.
            "unlinked": ["employees", "documents", "purchases", "attendance"],
        }

    # ------------------------------------------------------------------ #
    def _customer_names(self, tenant, facility: str) -> list[str]:
        names = (
            self._all(tenant)
            .filter(facility=facility)
            .exclude(consignee_name="")
            .values_list("consignee_name", flat=True)
            .distinct()
        )
        return sorted(set(names))

    def _is_sez(self, tenant, facility: str) -> bool:
        return self._all(tenant).filter(facility=facility, is_sez=True).exists()

    @staticmethod
    def _recent(queryset):
        return queryset.order_by("-invoice_date", "-sequence_number")[:RECENT_LIMIT]

    @staticmethod
    def _row(inv: Invoice) -> dict[str, Any]:
        return {
            "id": str(inv.id),
            "number": inv.number,
            "invoice_type": inv.invoice_type,
            "invoice_date": inv.invoice_date,
            "status": inv.status,
            "total": str(inv.total),
            "customer": inv.consignee_name,
            "period_text": inv.period_text,
        }

    def _activity(self, tenant, invoices) -> list[dict[str, Any]]:
        from audit.models import AuditLog

        invoice_ids = [str(pk) for pk in invoices.values_list("id", flat=True)]
        if not invoice_ids:
            return []
        entries = AuditLog.objects.filter(
            module="finance",
            object_type="Invoice",
            object_id__in=invoice_ids,
            **self._scope(tenant),
        ).order_by("-created_at")[:RECENT_LIMIT]
        return [
            {
                "action": entry.action,
                "at": entry.created_at,
                "object_id": entry.object_id,
                "number": entry.changes.get("number", ""),
            }
            for entry in entries
        ]
