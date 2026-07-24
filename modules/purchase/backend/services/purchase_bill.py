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
import logging
import time
from decimal import Decimal
from typing import Any

import httpx
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from shared.events import publish
from shared.exceptions import ConflictError
from shared.services import BaseService
from storage.services import StorageService
from tenancy.models import Tenant
from tenancy.services import TenancyService

from purchase.backend.events.registry import (
    PURCHASE_BILL_INGESTED,
    PURCHASE_BILL_NEEDS_ATTENTION,
    PURCHASE_BILL_PAID,
    PURCHASE_BILL_PROCESSED,
    PURCHASE_BILL_UNPAID,
)
from purchase.backend.models import BillStatus, PaymentStatus, PurchaseBill, Vendor
from purchase.backend.services.purchase_ocr import PurchaseOCRService

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = Decimal("0.80")

DOCUMENT_FETCH_RETRIES = 2
DOCUMENT_FETCH_TIMEOUT = 15.0
_EXT_BY_CONTENT_TYPE = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}


def _resolve_ingest_tenant() -> Tenant:
    tenant = TenancyService().resolve_existing_default_tenant()
    if tenant is None:
        raise ConflictError(
            "No company is configured yet. Set up the company profile before ingesting bills."
        )
    return tenant


def _fetch_and_store_document(document_url: str, *, tenant: Tenant, external_ref: str) -> str:
    """Downloads the source document's real bytes and stores them via the
    platform Storage service. Returns the storage key, or "" if the document
    couldn't be fetched or stored — a storage hiccup must not block
    ingestion, since `document_url` is retained on the bill either way."""
    if not document_url:
        return ""

    data: bytes | None = None
    content_type = "application/octet-stream"
    for attempt in range(1, DOCUMENT_FETCH_RETRIES + 1):
        try:
            response = httpx.get(document_url, timeout=DOCUMENT_FETCH_TIMEOUT)
            response.raise_for_status()
            data = response.content
            content_type = response.headers.get("content-type", content_type).split(";")[0].strip()
            break
        except httpx.HTTPError as exc:
            logger.warning(
                "Attempt %s/%s to fetch purchase document (%s) failed: %s",
                attempt,
                DOCUMENT_FETCH_RETRIES,
                external_ref or "no ref",
                exc,
            )
            if attempt < DOCUMENT_FETCH_RETRIES:
                time.sleep(0.5 * attempt)

    if not data:
        logger.warning(
            "Could not fetch source document for %s; ingesting without a stored file.",
            external_ref or "(no ref)",
        )
        return ""

    ext = _EXT_BY_CONTENT_TYPE.get(content_type, "")
    filename = f"purchase_{external_ref or 'doc'}" + (f".{ext}" if ext else "")
    try:
        stored = StorageService().store(
            data=data,
            filename=filename,
            content_type=content_type,
            module="purchase",
            category="bill",
            tenant=tenant,
        )
        return stored.key
    except Exception as exc:
        logger.warning(
            "Storage rejected purchase document for %s: %s", external_ref or "(no ref)", exc
        )
        return ""


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
            storage_key = _fetch_and_store_document(
                document_url, tenant=tenant, external_ref=external_ref
            )

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
                is_identified = bill.seller_name != "Pending OCR Processing"
                if confidence >= CONFIDENCE_THRESHOLD and is_identified:
                    bill.status = BillStatus.PROCESSED
                else:
                    bill.status = BillStatus.NEEDS_ATTENTION

                bill.save()

        except IntegrityError as exc:
            raise ConflictError("This document was already ingested.") from exc

        # Step 5: Connect to Search Service & Platform Events. Anything that
        # needs to react to a new bill (e.g. Documents registering it in the
        # DMS) subscribes to this event instead of being called directly —
        # see modules/documents/backend/events/subscribers.py.
        publish(PURCHASE_BILL_INGESTED, instance=bill)
        if bill.status == BillStatus.PROCESSED:
            publish(PURCHASE_BILL_PROCESSED, instance=bill)
        else:
            publish(PURCHASE_BILL_NEEDS_ATTENTION, instance=bill)
            self._notify_operator(bill)

        self._index_search(bill)
        return bill

    def _index_search(self, bill: PurchaseBill) -> None:
        """Push the bill into the Search Service so it's findable via Global
        Search. See purchase.backend.search.adapter for the registered index."""
        from search.services import SearchService

        reference = bill.invoice_number or f"{bill.currency} {bill.total_rate}"
        body = (
            f"Vendor: {bill.seller_name}, Invoice #: {bill.invoice_number}, "
            f"GST: {bill.gst_number}, Total: {bill.total_rate}"
        )
        try:
            SearchService().upsert(
                index="purchase",
                doc_id=str(bill.id),
                title=f"Purchase: {bill.seller_name} ({reference})",
                body=body,
                url="/purchase",
                tenant=bill.tenant,
            )
        except Exception as exc:
            logger.warning("Search indexing failed for purchase bill %s: %s", bill.id, exc)

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

        confidence_pct = int(bill.confidence_score * 100)
        body = (
            f"{bill.seller_name} — {bill.currency} {bill.total_rate} "
            f"(Low confidence: {confidence_pct}%)"
        )
        for recipient in User.objects.filter(id__in=recipients):
            NotificationService().create(
                recipient=recipient,
                tenant=bill.tenant,
                title="Purchase document requires review",
                body=body,
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

    def unmark_paid(self, *, bill: PurchaseBill, actor) -> PurchaseBill:
        """Reverses mark_paid — corrects a mistaken payment confirmation.
        The bill goes back to the unpaid worklist same as it would have if
        it had never been marked paid."""
        if bill.payment_status == PaymentStatus.UNPAID:
            raise ConflictError("Bill is already unpaid.")

        bill.payment_status = PaymentStatus.UNPAID
        bill.paid_at = None
        bill.save(update_fields=["payment_status", "paid_at", "updated_at"])
        publish(PURCHASE_BILL_UNPAID, instance=bill, actor=actor)
        return bill

    def delete_bill(self, *, bill: PurchaseBill, actor) -> None:
        """Delete a purchase bill record and record audit."""
        from purchase.backend.events.registry import PURCHASE_BILL_DELETED

        publish(PURCHASE_BILL_DELETED, instance=bill, actor=actor)
        bill.delete()

    # ------------------------------------------------------------------ #
    # Reporting
    # ------------------------------------------------------------------ #
    def build_report_spec(self, *, bills, filters: dict | None = None) -> Any:
        from reporting.filtering import filters_summary
        from reporting.spec import ReportColumn, ReportSpec

        rows = [
            {
                "vendor": bill.vendor.name if bill.vendor else bill.seller_name,
                "invoice": bill.invoice_number or "—",
                "date": bill.purchase_date.strftime("%Y-%m-%d"),
                "total": f"{bill.currency} {bill.total_rate}",
                "status": bill.get_status_display(),
                "payment": bill.get_payment_status_display(),
            }
            for bill in bills
        ]
        return ReportSpec(
            key="purchase-bills",
            title="Purchase bill register",
            module="purchase",
            columns=[
                ReportColumn("vendor", "Vendor"),
                ReportColumn("invoice", "Invoice #"),
                ReportColumn("date", "Date", align="right"),
                ReportColumn("total", "Total", align="right"),
                ReportColumn("status", "Status"),
                ReportColumn("payment", "Payment"),
            ],
            rows=rows,
            filters=filters_summary(filters or {}),
        )

    def build_reconciliation_spec(self, *, bills, filters: dict | None = None) -> Any:
        """Bills not yet settled: unpaid, or flagged for review — the
        operator's worklist for reconciling against bank/vendor statements."""
        from reporting.filtering import filters_summary
        from reporting.spec import ReportColumn, ReportSpec

        today = timezone.now().date()
        unresolved = bills.filter(
            Q(payment_status=PaymentStatus.UNPAID) | Q(status=BillStatus.NEEDS_ATTENTION)
        ).order_by("purchase_date")
        rows = [
            {
                "vendor": bill.vendor.name if bill.vendor else bill.seller_name,
                "invoice": bill.invoice_number or "—",
                "date": bill.purchase_date.strftime("%Y-%m-%d"),
                "total": f"{bill.currency} {bill.total_rate}",
                "days_outstanding": (
                    str((today - bill.purchase_date).days)
                    if bill.payment_status == PaymentStatus.UNPAID
                    else "—"
                ),
                "review": bill.get_status_display(),
            }
            for bill in unresolved
        ]
        return ReportSpec(
            key="purchase-reconciliation",
            title="Purchase reconciliation",
            module="purchase",
            subtitle="Unpaid bills and bills flagged for review.",
            columns=[
                ReportColumn("vendor", "Vendor"),
                ReportColumn("invoice", "Invoice #"),
                ReportColumn("date", "Date", align="right"),
                ReportColumn("total", "Total", align="right"),
                ReportColumn("days_outstanding", "Days outstanding", align="right"),
                ReportColumn("review", "Review status"),
            ],
            rows=rows,
            filters=filters_summary(filters or {}),
        )
