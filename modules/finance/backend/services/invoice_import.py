"""The bulk historical-invoice import — upload, read, review, commit.

The flow, and where each piece lives:

1. **Upload** (`create_batch`): each scan is stored once (platform/storage,
   content-hash deduped), an `InvoiceImportItem` is created `queued`, and one
   `platform/workflow` pipeline run is started per item. The call returns
   immediately — 30-40 OCR passes never block a web request.
2. **Read** (`run_extraction`, the pipeline step body): drained in the
   background by `pipeline_tick`. Runs OCR through the gateway, maps the result
   to an editable draft, matches a customer, and lands the item in
   `extracted` or `needs_attention`.
3. **Review** (`save_draft` / `compute_totals_for_draft`): the operator corrects
   the draft — above all the printed number — and totals recompute live from the
   same pure arithmetic generation uses.
4. **Commit** (`commit_item` / `commit_batch`): hands the reviewed draft to
   `InvoiceService.import_historical`, which writes the register row under its
   original number and reconciles the sequence.

Background ticks carry no thread-local tenant (see workflow/engine.tick_all), so
every query here filters by an explicit tenant rather than trusting the manager.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from django.conf import settings
from django.utils import timezone
from finance.backend.models import (
    IMPORT_ITEM_REVIEWABLE,
    IMPORT_ITEM_TERMINAL,
    InvoiceImportBatch,
    InvoiceImportBatchStatus,
    InvoiceImportItem,
    InvoiceImportItemStatus,
)
from finance.backend.pipelines import INVOICE_IMPORT_OCR_PIPELINE_KEY
from finance.backend.repositories.invoice import CustomerRepository
from finance.backend.services import computation
from finance.backend.services.invoice import InvoiceService
from finance.backend.services.invoice_ocr import InvoiceOCRService
from shared.exceptions import ConflictError, ValidationError
from shared.services import BaseService
from storage.services import StorageService
from workflow.services import PipelineService

logger = logging.getLogger(__name__)

# Scans only — the size limit is the platform default (STORAGE_MAX_UPLOAD_MB).
IMPORT_SCAN_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}

# One re-attempt on a hard (storage/db) error; kept in step with the pipeline's
# StepDefinition.max_attempts. OCR itself never raises — it degrades to a
# low-confidence blank — so this only covers infrastructure hiccups.
MAX_OCR_ATTEMPTS = 2

_DEFAULT_REVIEW_THRESHOLD = Decimal("0.75")


class InvoiceImportService(BaseService):
    # -- Upload ----------------------------------------------------------- #
    def create_batch(
        self, *, tenant, actor=None, files: list[dict[str, Any]], label: str = ""
    ) -> dict[str, Any]:
        """`files`: dicts of {filename, content_type, data(bytes)}. Stores each
        scan, creates an item, and queues its OCR. Duplicate scans (same bytes)
        are skipped, not re-imported."""
        if not files:
            raise ValidationError(detail={"files": ["Attach at least one invoice scan."]})

        batch = InvoiceImportBatch.objects.create(
            tenant=tenant,
            label=label.strip() or f"Historical import {timezone.now():%Y-%m-%d %H:%M}",
            status=InvoiceImportBatchStatus.PROCESSING,
            created_by=actor,
        )

        accepted: list[InvoiceImportItem] = []
        duplicates: list[str] = []
        seen: set[str] = set()
        for entry in files:
            data: bytes = entry["data"]
            filename: str = entry.get("filename") or "scan"
            content_type: str = entry.get("content_type") or "application/octet-stream"
            content_hash = hashlib.sha256(data).hexdigest()
            if content_hash in seen:
                duplicates.append(filename)
                continue
            seen.add(content_hash)

            stored = StorageService().store(
                data=data,
                filename=filename,
                content_type=content_type,
                module="finance",
                category="invoice_import_scan",
                tenant=tenant,
                uploaded_by=actor,
                allowed_types=IMPORT_SCAN_ALLOWED_TYPES,
                metadata={"batch_id": str(batch.id), "purpose": "historical-invoice-import"},
            )
            item = InvoiceImportItem.objects.create(
                tenant=tenant,
                batch=batch,
                source_file=stored,
                original_filename=filename[:255],
                content_hash=content_hash,
                status=InvoiceImportItemStatus.QUEUED,
            )
            run, _created = PipelineService().start(
                pipeline_key=INVOICE_IMPORT_OCR_PIPELINE_KEY,
                tenant=tenant,
                actor=actor,
                trigger_type="manual",
                idempotency_key=f"invoice-import:{item.id}",
                source_module="finance",
                source_object_type="InvoiceImportItem",
                source_object_id=str(item.id),
                input_data={"item_id": str(item.id)},
            )
            item.run_id = str(run.id)
            item.save(update_fields=["run_id", "updated_at"])
            accepted.append(item)

        self._refresh_batch_status(batch)
        return {"batch": batch, "accepted": accepted, "duplicates": duplicates}

    # -- Read (pipeline step body) --------------------------------------- #
    def run_extraction(self, *, item_id, tenant, attempt: int = 1) -> dict[str, Any]:
        item = InvoiceImportItem.objects.filter(tenant=tenant, id=item_id).first()
        if item is None or item.status in IMPORT_ITEM_TERMINAL:
            return {"status": item.status if item else "missing"}

        if item.status != InvoiceImportItemStatus.PROCESSING:
            item.status = InvoiceImportItemStatus.PROCESSING
            item.save(update_fields=["status", "updated_at"])

        try:
            image_bytes = StorageService().open(item.source_file)
            raw = InvoiceOCRService().extract_from_image(
                image_bytes,
                mime_type=item.source_file.content_type or "image/jpeg",
                tenant=tenant,
            )
        except Exception as exc:  # noqa: BLE001 - infra hiccup; retry then fail the item
            item.error_message = str(exc)[:500]
            if attempt < MAX_OCR_ATTEMPTS:
                item.save(update_fields=["error_message", "updated_at"])
                raise  # let the engine retry this step with backoff
            item.status = InvoiceImportItemStatus.FAILED
            item.save(update_fields=["status", "error_message", "updated_at"])
            self._refresh_batch_status(item.batch)
            return {"status": InvoiceImportItemStatus.FAILED.value}

        draft = self._build_draft_from_extraction(raw, tenant=tenant)
        confidence = _decimal(raw.get("confidence_score"), Decimal("0")).quantize(Decimal("0.001"))
        item.raw_extraction = raw
        item.proposed = draft
        item.confidence_score = confidence
        self._sync_denormalized(item, draft, tenant=tenant)
        item.status = self._review_status(draft, confidence, item.proposed_total)
        item.error_message = ""
        item.save()
        self._refresh_batch_status(item.batch)
        return {"status": item.status.value, "confidence": float(confidence)}

    # -- Review ----------------------------------------------------------- #
    def save_draft(self, *, item: InvoiceImportItem, draft: dict[str, Any]) -> InvoiceImportItem:
        """Merge an operator edit into the draft (patch semantics) and recompute
        the denormalized number/date/total the grid sorts on."""
        if item.status in IMPORT_ITEM_TERMINAL:
            raise ConflictError("This item is already committed or discarded.")
        merged = {**(item.proposed or {}), **draft}
        item.proposed = merged
        self._sync_denormalized(item, merged, tenant=item.tenant)
        item.save(
            update_fields=[
                "proposed",
                "proposed_number",
                "proposed_invoice_date",
                "proposed_total",
                "updated_at",
            ]
        )
        return item

    def compute_totals_for_draft(self, *, tenant, draft: dict[str, Any]) -> dict[str, Any]:
        """The tax split and totals a draft would produce — the same arithmetic
        `InvoiceService` commits, so the grid's live figures match the bill."""
        customer = self._resolve_customer(tenant, draft.get("customer_id"))
        sez_raw = draft.get("is_sez")
        is_sez = customer.is_sez if sez_raw is None and customer else bool(sez_raw)
        tax_mode = computation.tax_mode_for(is_sez=is_sez)
        gst_rate = _decimal(draft.get("gst_rate"), computation.DEFAULT_GST_RATE)
        lines = computation.compute_lines(draft.get("lines") or [])
        totals = computation.compute_totals(lines, tax_mode=tax_mode, gst_rate=gst_rate)
        return {
            "subtotal": totals.subtotal,
            "cgst_amount": totals.cgst_amount,
            "sgst_amount": totals.sgst_amount,
            "igst_amount": totals.igst_amount,
            "round_off": totals.round_off,
            "total": totals.total,
            "tax_mode": tax_mode,
            "gst_rate": gst_rate,
        }

    # -- Commit ----------------------------------------------------------- #
    def commit_item(self, *, item: InvoiceImportItem, actor=None):
        if item.status == InvoiceImportItemStatus.COMMITTED and item.invoice_id:
            return item.invoice  # idempotent
        if item.status == InvoiceImportItemStatus.DISCARDED:
            raise ConflictError("A discarded item cannot be committed.")

        draft = item.proposed or {}
        number = (draft.get("number") or "").strip()
        if not number:
            raise ValidationError(detail={"number": ["An invoice number is required to commit."]})
        invoice_date = _parse_date(draft.get("invoice_date"))
        if invoice_date is None:
            raise ValidationError(
                detail={"invoice_date": ["A valid invoice date is required to commit."]}
            )

        customer = self._resolve_customer(item.tenant, draft.get("customer_id"))
        invoice = InvoiceService().import_historical(
            number=number,
            source_file=item.source_file,
            actor=actor,
            tenant=item.tenant,
            invoice_type=draft.get("invoice_type", "sales"),
            invoice_date=invoice_date,
            customer=customer,
            consignee_name=draft.get("consignee_name", ""),
            consignee_address=draft.get("consignee_address", ""),
            facility=draft.get("facility", ""),
            gstin=draft.get("gstin", ""),
            is_sez=draft.get("is_sez"),
            gst_rate=draft.get("gst_rate"),
            period_year=draft.get("period_year"),
            period_month=draft.get("period_month"),
            lines=draft.get("lines", []),
        )
        item.invoice = invoice
        item.status = InvoiceImportItemStatus.COMMITTED
        item.error_message = ""
        item.save(update_fields=["invoice", "status", "error_message", "updated_at"])
        self._refresh_batch_status(item.batch)
        return invoice

    def commit_batch(self, *, batch: InvoiceImportBatch, actor=None) -> dict[str, Any]:
        """Commits every reviewable item, one independent transaction each, so a
        single bad row never rolls back the good ones."""
        items = InvoiceImportItem.objects.filter(
            tenant=batch.tenant, batch=batch, status__in=IMPORT_ITEM_REVIEWABLE
        )
        committed, failed = [], []
        for item in items:
            try:
                invoice = self.commit_item(item=item, actor=actor)
                committed.append(
                    {
                        "item_id": str(item.id),
                        "invoice_id": str(invoice.id),
                        "number": invoice.number,
                    }
                )
            except (ValidationError, ConflictError) as exc:
                failed.append({"item_id": str(item.id), "error": _error_text(exc)})
        self._refresh_batch_status(batch)
        return {"committed": committed, "failed": failed}

    def discard_item(self, *, item: InvoiceImportItem) -> InvoiceImportItem:
        if item.status == InvoiceImportItemStatus.COMMITTED:
            raise ConflictError("A committed item cannot be discarded; cancel the invoice instead.")
        item.status = InvoiceImportItemStatus.DISCARDED
        item.save(update_fields=["status", "updated_at"])
        self._refresh_batch_status(item.batch)
        return item

    # -- Helpers ---------------------------------------------------------- #
    def _build_draft_from_extraction(self, raw: dict[str, Any], *, tenant) -> dict[str, Any]:
        customer = self._match_customer(
            tenant, gstin=raw.get("gstin"), name=raw.get("consignee_name")
        )
        gst_rate = raw.get("gst_rate") or "0"
        if _decimal(gst_rate, Decimal("0")) <= 0:
            gst_rate = str(computation.DEFAULT_GST_RATE)
        return {
            "number": raw.get("number", ""),
            "invoice_type": raw.get("invoice_type", "sales"),
            "invoice_date": raw.get("invoice_date"),
            "customer_id": str(customer.id) if customer else None,
            "consignee_name": raw.get("consignee_name") or (customer.name if customer else ""),
            "consignee_address": raw.get("consignee_address")
            or (customer.address if customer else ""),
            "facility": customer.facility if customer else "",
            "gstin": raw.get("gstin") or (customer.gstin if customer else ""),
            "is_sez": customer.is_sez if customer else bool(raw.get("is_sez")),
            "gst_rate": gst_rate,
            "period_year": raw.get("period_year"),
            "period_month": raw.get("period_month"),
            "lines": raw.get("lines", []),
        }

    def _match_customer(self, tenant, *, gstin, name):
        repo = CustomerRepository().for_tenant(tenant.id if tenant else None)
        gstin = (gstin or "").strip()
        if gstin:
            match = repo.filter(gstin__iexact=gstin).first()
            if match:
                return match
        name = (name or "").strip()
        if name:
            return repo.filter(name__iexact=name).first()
        return None

    def _resolve_customer(self, tenant, customer_id):
        if not customer_id:
            return None
        return (
            CustomerRepository()
            .for_tenant(tenant.id if tenant else None)
            .filter(id=customer_id)
            .first()
        )

    def _sync_denormalized(self, item: InvoiceImportItem, draft: dict[str, Any], *, tenant) -> None:
        item.proposed_number = (draft.get("number") or "")[:60]
        item.proposed_invoice_date = _parse_date(draft.get("invoice_date"))
        item.proposed_total = self.compute_totals_for_draft(tenant=tenant, draft=draft)["total"]

    def _review_status(self, draft: dict[str, Any], confidence: Decimal, total) -> str:
        threshold = _decimal(
            getattr(settings, "INVOICE_OCR_REVIEW_THRESHOLD", _DEFAULT_REVIEW_THRESHOLD),
            _DEFAULT_REVIEW_THRESHOLD,
        )
        incomplete = (
            not (draft.get("number") or "").strip()
            or _parse_date(draft.get("invoice_date")) is None
            or Decimal(str(total)) <= 0
        )
        if confidence < threshold or incomplete:
            return InvoiceImportItemStatus.NEEDS_ATTENTION
        return InvoiceImportItemStatus.EXTRACTED

    def _refresh_batch_status(self, batch: InvoiceImportBatch) -> None:
        if batch.status == InvoiceImportBatchStatus.ARCHIVED:
            return
        statuses = set(
            InvoiceImportItem.objects.filter(tenant=batch.tenant, batch=batch).values_list(
                "status", flat=True
            )
        )
        if not statuses:
            return
        active = {InvoiceImportItemStatus.QUEUED, InvoiceImportItemStatus.PROCESSING}
        terminal = {InvoiceImportItemStatus.COMMITTED, InvoiceImportItemStatus.DISCARDED}
        if statuses & active:
            new_status = InvoiceImportBatchStatus.PROCESSING
        elif statuses <= terminal:
            new_status = InvoiceImportBatchStatus.COMPLETED
        else:
            new_status = InvoiceImportBatchStatus.REVIEW
        if batch.status != new_status:
            batch.status = new_status
            batch.save(update_fields=["status", "updated_at"])


def _decimal(value: Any, default: Decimal) -> Decimal:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return default


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def _error_text(exc: Exception) -> str:
    detail = getattr(exc, "detail", None)
    if isinstance(detail, dict):
        return "; ".join(
            f"{field}: {' '.join(str(m) for m in msgs)}"
            if isinstance(msgs, list)
            else f"{field}: {msgs}"
            for field, msgs in detail.items()
        )
    return str(detail or exc)
