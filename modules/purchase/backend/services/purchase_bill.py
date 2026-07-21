"""Purchase bill business logic: ingest from a document channel, then confirm
or reject during human review.

Tenant resolution: bills are ingested by a service (Telegram bot), which has
no JWT/tenant context. In single-operator mode there is exactly one tenant;
`_resolve_ingest_tenant` uses it automatically via `TenancyService` (shared
with `auth`'s registration bootstrap — this module never creates a tenant
itself, only the human sign-up flow does that).
"""

from __future__ import annotations

from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone
from shared.events import publish
from shared.exceptions import ConflictError, NotFoundError, ValidationError
from shared.services import BaseService
from tenancy.models import Tenant
from tenancy.services import TenancyService

from purchase.backend.events.registry import (
    PURCHASE_BILL_CONFIRMED,
    PURCHASE_BILL_INGESTED,
    PURCHASE_BILL_PAID,
    PURCHASE_BILL_REJECTED,
)
from purchase.backend.models import BillStatus, PaymentStatus, PurchaseBill, Vendor


def _resolve_ingest_tenant() -> Tenant:
    tenant = TenancyService().resolve_existing_default_tenant()
    if tenant is None:
        raise ConflictError(
            "No company is configured yet. Set up the company profile before ingesting bills."
        )
    return tenant


class PurchaseBillService(BaseService):
    def ingest(
        self,
        *,
        data: dict[str, Any],
        source_channel: str,
        raw_extraction: dict | None = None,
    ) -> PurchaseBill:
        tenant = _resolve_ingest_tenant()

        # Dedupe: a channel resending the same document (Telegram re-forward,
        # retry after a timeout) must not create a second review item. The
        # partial unique constraint backs this check against races.
        data["external_ref"] = (data.get("external_ref") or "").strip()
        if data["external_ref"]:
            existing = PurchaseBill.objects.filter(
                tenant=tenant, source_channel=source_channel, external_ref=data["external_ref"]
            ).first()
            if existing:
                if existing.status == BillStatus.PENDING_REVIEW:
                    for field, value in data.items():
                        if value is not None and hasattr(existing, field):
                            setattr(existing, field, value)
                    if raw_extraction:
                        existing.raw_extraction = raw_extraction
                    existing.save()
                    return existing
                raise ConflictError("This document was already ingested.")

        try:
            with transaction.atomic():
                bill = PurchaseBill.objects.create(
                    tenant=tenant,
                    source_channel=source_channel,
                    raw_extraction=raw_extraction or {},
                    **data,
                )
                # Auto-register document in Documents App (DMS)
                try:
                    from documents.backend.models import Document, DocumentCategory
                    from users.models import User

                    owner = User.objects.filter(tenant=tenant).first()
                    Document.objects.get_or_create(
                        tenant=tenant,
                        title=f"Receipt - {bill.seller_name} ({bill.purchase_date})",
                        defaults={
                            "owner": owner,
                            "category": DocumentCategory.FINANCIAL,
                            "description": f"Source: {source_channel.title()} Bot. Total: {bill.currency} {bill.total_rate}. URL: {bill.document_url}",
                        },
                    )
                except Exception:
                    pass
        except IntegrityError as exc:  # concurrent resend lost the race
            raise ConflictError("This document was already ingested.") from exc
        publish(PURCHASE_BILL_INGESTED, instance=bill)
        self._notify_operator(bill)
        return bill

    def _notify_operator(self, bill: PurchaseBill) -> None:
        """Best-effort: let the operator know a bill needs review. Never
        blocks ingestion if no reviewer can be found yet (bootstrap gap)."""
        from notifications.services import NotificationService
        from roles.models import Role

        owner_role = Role.objects.filter(tenant__isnull=True, slug="owner").first()
        if owner_role is None:
            return
        recipients = owner_role.assignments.filter(user__tenant=bill.tenant).values_list(
            "user", flat=True
        )
        from users.models import User

        for recipient in User.objects.filter(id__in=recipients):
            NotificationService().create(
                recipient=recipient,
                tenant=bill.tenant,
                title="New purchase bill needs review",
                body=f"{bill.seller_name} — {bill.currency} {bill.total_rate}",
                category="purchase",
                data={"bill_id": str(bill.id)},
            )

    def confirm(self, *, bill: PurchaseBill, reviewer, vendor_name: str = "") -> PurchaseBill:
        if bill.status != BillStatus.PENDING_REVIEW:
            raise ConflictError(f"Bill is already {bill.status}.")

        vendor = None
        if vendor_name:
            vendor, _ = Vendor.objects.get_or_create(tenant=bill.tenant, name=vendor_name.strip())

        bill.vendor = vendor
        bill.status = BillStatus.CONFIRMED
        bill.reviewed_by = reviewer
        bill.reviewed_at = timezone.now()
        bill.save(update_fields=["vendor", "status", "reviewed_by", "reviewed_at", "updated_at"])
        publish(PURCHASE_BILL_CONFIRMED, instance=bill, actor=reviewer)
        return bill

    def reject(self, *, bill: PurchaseBill, reviewer, reason: str) -> PurchaseBill:
        if bill.status != BillStatus.PENDING_REVIEW:
            raise ConflictError(f"Bill is already {bill.status}.")
        if not reason.strip():
            raise ValidationError(detail={"reason": ["A rejection reason is required."]})

        bill.status = BillStatus.REJECTED
        bill.reviewed_by = reviewer
        bill.reviewed_at = timezone.now()
        bill.rejection_reason = reason.strip()
        bill.save(
            update_fields=["status", "reviewed_by", "reviewed_at", "rejection_reason", "updated_at"]
        )
        publish(PURCHASE_BILL_REJECTED, instance=bill, actor=reviewer)
        return bill

    def mark_paid(self, *, bill: PurchaseBill, actor) -> PurchaseBill:
        if bill.status != BillStatus.CONFIRMED:
            raise ConflictError("Only a confirmed bill can be marked paid.")
        if bill.payment_status == PaymentStatus.PAID:
            raise ConflictError("Bill is already marked paid.")

        bill.payment_status = PaymentStatus.PAID
        bill.paid_at = timezone.now()
        bill.save(update_fields=["payment_status", "paid_at", "updated_at"])
        publish(PURCHASE_BILL_PAID, instance=bill, actor=actor)
        return bill

    def get_for_review(self, *, bill_id, tenant) -> PurchaseBill:
        bill = PurchaseBill.objects.filter(id=bill_id, tenant=tenant).first()
        if bill is None:
            raise NotFoundError("Purchase bill not found.")
        return bill
