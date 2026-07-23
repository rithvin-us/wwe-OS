"""Purchase bill business logic.

The purchase already occurred in the real world. WWE OS digitizes, stores,
analyzes, and links the purchase.

Flow:
1. Always store document first in Storage Service.
2. Create Purchase record in Database immediately.
3. Process OCR extraction via platform AI Gateway.
4. Auto-classify: confidence >= 0.8 -> PROCESSED; confidence < 0.8 -> NEEDS_ATTENTION.
5. Index in Search Service, emit Audit logs, and notify if manual attention is needed.
"""

from __future__ import annotations

import datetime
from decimal import Decimal
from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone
from shared.events import publish
from shared.exceptions import ConflictError, NotFoundError, ValidationError
from shared.services import BaseService
from storage.services import StorageService
from tenancy.models import Tenant
from tenancy.services import TenancyService

from purchase.backend.events.registry import (
    PURCHASE_BILL_INGESTED,
    PURCHASE_BILL_NEEDS_ATTENTION,
    PURCHASE_BILL_PAID,
    PURCHASE_BILL_PROCESSED,
)
from purchase.backend.models import BillStatus, PaymentStatus, PurchaseBill, Vendor
from purchase.backend.services.purchase_ocr import PurchaseOCRService

CONFIDENCE_THRESHOLD = Decimal("0.80")


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
        source_channel: str = "telegram",
        raw_extraction: dict | None = None,
        document_text: str = "",
    ) -> PurchaseBill:
        tenant = _resolve_ingest_tenant()

        seller_name = data.get("seller_name") or "Pending OCR Processing"
        purchase_date = data.get("purchase_date") or datetime.date.today()
        total_rate = Decimal(str(data.get("total_rate") or "0.00"))
        currency = (data.get("currency") or "INR").upper()
        document_url = data.get("document_url") or ""
        external_ref = (data.get("external_ref") or "").strip()

        # Check for existing record by external_ref
        existing = None
        if external_ref:
            existing = PurchaseBill.objects.filter(
                tenant=tenant, source_channel=source_channel, external_ref=external_ref
            ).first()

        storage_key = existing.storage_key if existing else ""
        if not storage_key:
            try:
                stored = StorageService().store(
                    file_obj=document_url.encode("utf-8"),
                    filename=f"purchase_{external_ref or 'doc'}.pdf",
                    content_type="application/pdf",
                    module="purchase",
                    category="bill",
                    tenant=tenant,
                )
                storage_key = stored.key
            except Exception:
                storage_key = f"purchase/{tenant.id}/{external_ref or 'doc'}"

        try:
            with transaction.atomic():
                if existing:
                    bill = existing
                    if seller_name != "Pending OCR Processing":
                        bill.seller_name = seller_name
                    if total_rate > 0:
                        bill.total_rate = total_rate
                    bill.currency = currency
                    if document_url:
                        bill.document_url = document_url
                    if raw_extraction:
                        bill.raw_extraction = raw_extraction
                else:
                    bill = PurchaseBill.objects.create(
                        tenant=tenant,
                        seller_name=seller_name,
                        purchase_date=purchase_date,
                        total_rate=total_rate,
                        currency=currency,
                        document_url=document_url,
                        telegram_user_id=data.get("telegram_user_id"),
                        external_ref=external_ref,
                        source_channel=source_channel,
                        storage_key=storage_key,
                        raw_extraction=raw_extraction or {},
                        status=BillStatus.PROCESSED,
                    )

                # Step 3: Run AI OCR extraction or parse raw extraction
                ocr_service = PurchaseOCRService()
                extracted = ocr_service.parse_raw_or_extract(
                    raw_extraction=raw_extraction or bill.raw_extraction,
                    document_text=document_text,
                    tenant=tenant,
                )

                # Populate extracted fields
                if extracted.get("vendor"):
                    bill.seller_name = extracted["vendor"]
                    vendor, _ = Vendor.objects.get_or_create(
                        tenant=tenant, name=extracted["vendor"].strip()
                    )
                    bill.vendor = vendor

                if extracted.get("invoice_number"):
                    bill.invoice_number = extracted["invoice_number"]

                if extracted.get("invoice_date"):
                    try:
                        if isinstance(extracted["invoice_date"], str):
                            bill.invoice_date = datetime.datetime.strptime(
                                extracted["invoice_date"], "%Y-%m-%d"
                            ).date()
                        elif isinstance(extracted["invoice_date"], datetime.date):
                            bill.invoice_date = extracted["invoice_date"]
                    except Exception:
                        pass

                if extracted.get("gst_number"):
                    bill.gst_number = extracted["gst_number"]
                    if bill.vendor and not bill.vendor.gst_number:
                        bill.vendor.gst_number = extracted["gst_number"]
                        bill.vendor.save(update_fields=["gst_number"])

                if extracted.get("items"):
                    bill.items = extracted["items"]

                if extracted.get("total_quantity"):
                    bill.total_quantity = Decimal(str(extracted["total_quantity"]))

                if extracted.get("tax_amount"):
                    bill.tax_amount = Decimal(str(extracted["tax_amount"]))

                if extracted.get("grand_total") and float(extracted["grand_total"]) > 0:
                    bill.total_rate = Decimal(str(extracted["grand_total"]))

                if extracted.get("currency"):
                    bill.currency = extracted["currency"]
                else:
                    bill.currency = "INR"

                if extracted.get("payment_method"):
                    bill.payment_method = extracted["payment_method"]

                confidence = Decimal(str(extracted.get("confidence_score") or "0.85"))
                bill.confidence_score = confidence
                bill.raw_extraction = extracted

                # Duplicate detection check
                if bill.invoice_number:
                    duplicate_exists = (
                        PurchaseBill.objects.filter(
                            tenant=tenant,
                            seller_name=bill.seller_name,
                            invoice_number=bill.invoice_number,
                        )
                        .exclude(id=bill.id)
                        .exists()
                    )
                    if duplicate_exists:
                        bill.is_duplicate = True

                # Step 4: Auto-classification based on OCR confidence score
                if confidence >= CONFIDENCE_THRESHOLD and bill.seller_name != "Pending OCR Processing":
                    bill.status = BillStatus.PROCESSED
                else:
                    bill.status = BillStatus.NEEDS_ATTENTION

                bill.save()

                # Step 5: Auto-register document in Documents App (DMS)
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
                            "description": (
                                f"Invoice #{bill.invoice_number or 'N/A'}. Source: {source_channel.title()}. "
                                f"Total: {bill.currency} {bill.total_rate}. URL: {bill.document_url}"
                            ),
                        },
                    )
                except Exception:
                    pass

        except IntegrityError as exc:
            raise ConflictError("This document was already ingested.") from exc

        # Step 6: Connect to Search Service & Platform Events
        publish(PURCHASE_BILL_INGESTED, instance=bill)
        if bill.status == BillStatus.PROCESSED:
            publish(PURCHASE_BILL_PROCESSED, instance=bill)
        else:
            publish(PURCHASE_BILL_NEEDS_ATTENTION, instance=bill)
            self._notify_operator(bill)

        self._index_search(bill)
        return bill

    def _index_search(self, bill: PurchaseBill) -> None:
        """Connect to Search Service."""
        try:
            from search.services import SearchService

            SearchService().index(
                tenant=bill.tenant,
                module="purchase",
                title=f"Purchase: {bill.seller_name} ({bill.invoice_number or bill.currency + ' ' + str(bill.total_rate)})",
                content=f"Vendor: {bill.seller_name}, Invoice #: {bill.invoice_number}, GST: {bill.gst_number}, Total: {bill.total_rate}",
                url=f"/purchase",
            )
        except Exception:
            pass

    def _notify_operator(self, bill: PurchaseBill) -> None:
        """Notify operator when a purchase bill needs attention."""
        from notifications.services import NotificationService
        from roles.models import Role
        from users.models import User

        owner_role = Role.objects.filter(tenant__isnull=True, slug="owner").first()
        if owner_role is None:
            return
        recipients = owner_role.assignments.filter(user__tenant=bill.tenant).values_list(
            "user", flat=True
        )

        for recipient in User.objects.filter(id__in=recipients):
            NotificationService().create(
                recipient=recipient,
                tenant=bill.tenant,
                title="Purchase document requires review",
                body=f"{bill.seller_name} — {bill.currency} {bill.total_rate} (Low confidence: {int(bill.confidence_score * 100)}%)",
                category="purchase",
                data={"bill_id": str(bill.id)},
            )

    def update_bill(self, *, bill: PurchaseBill, actor, data: dict[str, Any]) -> PurchaseBill:
        """Update/correct a Purchase record (e.g. for NEEDS_ATTENTION items)."""
        vendor_name = data.pop("vendor_name", None)
        if vendor_name:
            vendor, _ = Vendor.objects.get_or_create(tenant=bill.tenant, name=vendor_name.strip())
            bill.vendor = vendor

        for field, val in data.items():
            if hasattr(bill, field) and val is not None:
                setattr(bill, field, val)

        bill.status = BillStatus.PROCESSED
        bill.save()
        publish(PURCHASE_BILL_PROCESSED, instance=bill, actor=actor)
        self._index_search(bill)
        return bill

    def mark_paid(self, *, bill: PurchaseBill, actor) -> PurchaseBill:
        if bill.payment_status == PaymentStatus.PAID:
            raise ConflictError("Bill is already marked paid.")

        bill.payment_status = PaymentStatus.PAID
        bill.paid_at = timezone.now()
        bill.save(update_fields=["payment_status", "paid_at", "updated_at"])
        publish(PURCHASE_BILL_PAID, instance=bill, actor=actor)
        return bill

    def delete_bill(self, *, bill: PurchaseBill, actor) -> None:
        """Delete a purchase bill record and record audit."""
        from purchase.backend.events.registry import PURCHASE_BILL_DELETED

        publish(PURCHASE_BILL_DELETED, instance=bill, actor=actor)
        bill.delete()
