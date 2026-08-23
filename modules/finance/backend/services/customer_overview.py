"""Customer 360 — one read-only view of everything the platform knows about a
billing customer, assembled from data that already exists.

Deliberately honest about the data model as it stands today:

- **Invoices** are a real foreign key (`Invoice.customer`), so financials, the
  invoice list and the AMC list are exact.
- **Sites** are *derived*, not a second copy of the truth: an invoice snapshots
  the `facility` it was raised for, so the distinct facilities this customer has
  been billed at — plus the customer's own default facility — are its sites.
  No `Site` table is invented; when sites become independently editable that is
  a deliberate migration, not this view.
- **Recent activity** is read from the platform audit trail (the immutable
  record every generate/correct/cancel already writes), filtered to this
  customer's invoices.

Areas the current data model does not link to a customer (purchases are
supplier-facing; documents/contracts carry no customer foreign key yet) are
left out rather than faked — the caller renders honest blanks. Outstanding
balances are likewise absent because invoices track issued/cancelled only, not
payment; the view reports what was invoiced, never an invented "outstanding".
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Count, Max, Sum
from finance.backend.models.invoice import Customer, Invoice, InvoiceStatus, InvoiceType
from shared.services import BaseService

RECENT_LIMIT = 10


def _money(value: Decimal | None) -> str:
    """Money as a fixed 2-dp string. `Sum` returns an unquantized Decimal, so
    normalise here rather than let the wire format wobble between rows."""
    return str((value or Decimal("0.00")).quantize(Decimal("0.01")))


class CustomerOverviewService(BaseService):
    def overview(self, *, customer: Customer) -> dict[str, Any]:
        invoices = Invoice.objects.filter(tenant=customer.tenant, customer=customer)
        active = invoices.exclude(status=InvoiceStatus.CANCELLED)

        return {
            "customer": self._profile(customer),
            "financials": self._financials(invoices, active),
            "sites": self._sites(customer, active),
            "invoices": [self._invoice_row(inv) for inv in self._recent(invoices)],
            "amc": [
                self._invoice_row(inv)
                for inv in self._recent(active.filter(invoice_type=InvoiceType.AMC))
            ],
            "activity": self._activity(customer, invoices),
        }

    # ------------------------------------------------------------------ #
    @staticmethod
    def _profile(customer: Customer) -> dict[str, Any]:
        return {
            "id": str(customer.id),
            "name": customer.name,
            "address": customer.address,
            "facility": customer.facility,
            "gstin": customer.gstin,
            "state": customer.state,
            "is_sez": customer.is_sez,
            "is_active": customer.is_active,
        }

    @staticmethod
    def _financials(invoices, active) -> dict[str, Any]:
        invoiced = active.aggregate(total=Sum("total"))["total"]
        return {
            "total_invoiced": _money(invoiced),
            "invoice_count": invoices.count(),
            "active_count": active.count(),
            "cancelled_count": invoices.filter(status=InvoiceStatus.CANCELLED).count(),
            "amc_count": active.filter(invoice_type=InvoiceType.AMC).count(),
            "sales_count": active.filter(invoice_type=InvoiceType.SALES).count(),
            # Payment is not tracked on invoices yet, so an "outstanding" figure
            # would be invented — reported as null, rendered as an honest blank.
            "outstanding": None,
        }

    @staticmethod
    def _sites(customer: Customer, active) -> list[dict[str, Any]]:
        rows = (
            active.exclude(facility="")
            .values("facility")
            .annotate(
                invoice_count=Count("id"),
                total_invoiced=Sum("total"),
                last_invoice_date=Max("invoice_date"),
            )
            .order_by("-total_invoiced")
        )
        sites = [
            {
                "name": row["facility"],
                "invoice_count": row["invoice_count"],
                "total_invoiced": _money(row["total_invoiced"]),
                "last_invoice_date": row["last_invoice_date"],
            }
            for row in rows
        ]
        # The customer's own default facility is a site even if nothing has been
        # billed against it yet.
        known = {site["name"] for site in sites}
        if customer.facility and customer.facility not in known:
            sites.append(
                {
                    "name": customer.facility,
                    "invoice_count": 0,
                    "total_invoiced": "0.00",
                    "last_invoice_date": None,
                }
            )
        return sites

    @staticmethod
    def _recent(queryset):
        return queryset.order_by("-invoice_date", "-sequence_number")[:RECENT_LIMIT]

    @staticmethod
    def _invoice_row(inv: Invoice) -> dict[str, Any]:
        return {
            "id": str(inv.id),
            "number": inv.number,
            "invoice_type": inv.invoice_type,
            "invoice_date": inv.invoice_date,
            "status": inv.status,
            "total": str(inv.total),
            "facility": inv.facility,
            "period_text": inv.period_text,
        }

    @staticmethod
    def _activity(customer: Customer, invoices) -> list[dict[str, Any]]:
        # Audit is a platform capability; finance reads its own object's trail.
        from audit.models import AuditLog

        invoice_ids = [str(pk) for pk in invoices.values_list("id", flat=True)]
        if not invoice_ids:
            return []
        entries = AuditLog.objects.filter(
            tenant=customer.tenant,
            module="finance",
            object_type="Invoice",
            object_id__in=invoice_ids,
        ).order_by("-created_at")[:RECENT_LIMIT]
        return [
            {
                "action": entry.action,
                "at": entry.created_at,
                "object_id": entry.object_id,
                "number": entry.changes.get("number", ""),
                "changes": entry.changes,
            }
            for entry in entries
        ]
