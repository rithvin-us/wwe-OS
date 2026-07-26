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
import re
import time
from decimal import Decimal
from typing import Any

import httpx
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from identity.models import IdentityChannel
from identity.services import IdentityService
from periods.models import BusinessPeriod
from periods.resolution import DocumentContext, resolve_location
from periods.services import PeriodService
from rules.services import RuleOutcome, RulesEngine
from shared.events import publish
from shared.exceptions import ConflictError
from shared.services import BaseService
from storage.services import StorageService, safe_filename
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

DOCUMENT_FETCH_RETRIES = 2
DOCUMENT_FETCH_TIMEOUT = 15.0
_EXT_BY_CONTENT_TYPE = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}
_IDENTITY_CHANNEL_MAP = {
    "telegram": IdentityChannel.TELEGRAM,
    "email": IdentityChannel.EMAIL,
    "upload": IdentityChannel.MANUAL,
}


def _resolve_ingest_tenant() -> Tenant:
    tenant = TenancyService().resolve_existing_default_tenant()
    if tenant is None:
        raise ConflictError(
            "No company is configured yet. Set up the company profile before ingesting bills."
        )
    return tenant


def _fetch_and_store_document(
    document_url: str,
    tenant: Tenant,
    business_date: datetime.date,
    source_channel: str,
    external_ref: str,
    document_base64: str = "",
) -> str:
    """Fetch source document (or decode document_base64) and store under STORAGE_LOCAL_PATH."""
    data: bytes | None = None
    content_type = "application/octet-stream"

    if document_base64:
        try:
            import base64

            data = base64.b64decode(document_base64)
            if data.startswith(b"%PDF"):
                content_type = "application/pdf"
            elif data.startswith(b"\x89PNG"):
                content_type = "image/png"
            elif data.startswith(b"\xff\xd8"):
                content_type = "image/jpeg"
        except Exception as exc:
            logger.warning("Failed to decode base64 document bytes: %s", exc)

    if not data and document_url:
        for attempt in range(1, DOCUMENT_FETCH_RETRIES + 1):
            try:
                response = httpx.get(document_url, timeout=DOCUMENT_FETCH_TIMEOUT)
                raw_ct = response.headers.get("content-type", content_type)
                content_type = raw_ct.split(";")[0].strip()
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
        resolved = resolve_location(
            DocumentContext(
                document_type="purchase_bill",
                document_name=safe_filename(filename),
                tenant_slug=tenant.slug,
                business_date=business_date,
                source_channel=source_channel,
            )
        )
        stored = StorageService().store(
            data=data,
            filename=filename,
            content_type=content_type,
            module="purchase",
            category="purchase_bill",
            tenant=tenant,
            key=resolved.key,
            period_year=resolved.period_year,
            period_month=resolved.period_month,
            is_library=resolved.is_library,
        )
        PeriodService().record_document(
            tenant=tenant, resolved=resolved, document_type="purchase_bill"
        )
        return stored.key
    except Exception as exc:
        logger.warning(
            "Storage rejected purchase document for %s: %s", external_ref or "(no ref)", exc
        )
        return ""


def extract_tags_from_caption(caption: str, tenant=None) -> list[str]:
    """Extract hashtags (#Auditor, #GST) and match existing system tags from caption text."""
    if not caption:
        return []
    tags: list[str] = []
    # 1. Extract hashtags
    hashtags = re.findall(r"#([A-Za-z0-9_-]+)", caption)
    for h in hashtags:
        h_clean = h.strip()
        if h_clean and h_clean not in tags:
            tags.append(h_clean)

    # 2. Match existing tags in the system if tenant is present
    if tenant:
        try:
            from tagging.models import Tag

            existing_tags = list(Tag.objects.filter(tenant=tenant).values_list("name", flat=True))
            caption_lower = caption.lower()
            for tag_name in existing_tags:
                if tag_name.lower() in caption_lower and tag_name not in tags:
                    tags.append(tag_name)
        except Exception:
            pass

    return tags


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

        # Every incoming bill gets a trusted Source Identity before OCR runs
        # (identity.services.IdentityService) — never skipped, even if
        # storage or OCR later fails, since "who sent this" is independent
        # of whether the document itself was fetched successfully.
        telegram_user_id = data.get("telegram_user_id")
        identity_external_id = (
            str(telegram_user_id) if telegram_user_id else external_ref or "unknown"
        )
        identity = IdentityService().resolve_identity(
            tenant=tenant,
            channel=_IDENTITY_CHANNEL_MAP.get(source_channel, IdentityChannel.WEBHOOK),
            external_id=identity_external_id,
            display_name=data.get("telegram_username", ""),
        )

        # Check for existing record by external_ref
        existing = None
        if external_ref:
            existing = PurchaseBill.objects.filter(
                tenant=tenant, source_channel=source_channel, external_ref=external_ref
            ).first()

        storage_key = existing.storage_key if existing else ""
        if not storage_key:
            storage_key = _fetch_and_store_document(
                document_url,
                tenant=tenant,
                external_ref=external_ref,
                business_date=purchase_date,
                source_channel=source_channel,
                document_base64=data.get("document_base64", ""),
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

                # Process caption & tags
                caption = (data.get("caption") or "").strip()
                provided_tags = list(data.get("tags") or [])
                caption_tags = extract_tags_from_caption(caption, tenant=tenant)
                all_tags = []
                for t in provided_tags + caption_tags:
                    if t and t not in all_tags:
                        all_tags.append(t)

                if all_tags:
                    try:
                        from tagging.services import TagService

                        TagService().set_tags_for_object(
                            tenant=tenant,
                            module="purchase",
                            object_type="PurchaseBill",
                            object_id=str(bill.id),
                            tag_names=all_tags,
                        )
                    except Exception as err:
                        logger.warning("Failed to tag ingested bill %s: %s", bill.id, err)

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
                    # The sending account "learns" its vendor over repeat
                    # ingests — Rules Engine (later) can read this mapping
                    # to skip re-asking. No inference logic lives here.
                    IdentityService().map_to(
                        identity=identity,
                        module="purchase",
                        object_type="Vendor",
                        object_id=str(vendor.id),
                    )

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

                # Duplicate detection check (the query stays here — Rules
                # Engine decides what the *fact* means, it doesn't run the
                # lookup itself; see design §2a).
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

                period_status = None
                try:
                    period_status = (
                        BusinessPeriod.objects.filter(
                            tenant=tenant, year=purchase_date.year, month=purchase_date.month
                        )
                        .values_list("status", flat=True)
                        .first()
                    )
                except Exception:  # noqa: BLE001 - a period lookup hiccup must not block ingestion
                    period_status = None

                # Step 4: only the Rules Engine approves a state transition.
                evaluation = RulesEngine().evaluate_purchase_bill(
                    confidence=confidence,
                    seller_name=bill.seller_name,
                    gst_number=bill.gst_number,
                    is_duplicate=bill.is_duplicate,
                    period_status=period_status,
                )
                bill.status = (
                    BillStatus.PROCESSED
                    if evaluation.outcome == RuleOutcome.APPROVED
                    else BillStatus.NEEDS_ATTENTION
                )
                bill.raw_extraction = {**extracted, "rule_reasons": evaluation.reasons}

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
        Search. Reuses the registered adapter (purchase.backend.search.adapter)
        rather than rebuilding title/body/extra here — the adapter is the
        single source of truth for what a purchase bill looks like as a
        search document, also used by SearchService.rebuild()."""
        from search.services import SearchService

        from purchase.backend.search.adapter import to_document

        try:
            SearchService().upsert(index="purchase", tenant=bill.tenant, **to_document(bill))
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
