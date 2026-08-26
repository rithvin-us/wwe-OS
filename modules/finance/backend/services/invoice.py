"""The life of a bill: raise it, correct it, cancel it.

**Raising.** The order of operations is deliberate:

1. resolve the customer and snapshot it,
2. compute lines, tax mode and totals (pure, see `computation`),
3. refuse if the business period is locked,
4. reserve the next number from the shared register,
5. render the workbook from the master template and the PDF that gets sent,
6. store both at a business-period path, mirror them to the local archive,
7. write the register row.

All of it runs in one transaction, so a failure anywhere gives the number back
rather than leaving a hole in the sequence.

**Correcting.** A raised bill keeps its number. `update` recomputes it,
regenerates both documents under the same number, and bumps `revision` — so
"which copy is current" always has an answer, and the audit log holds what
changed. A bill filed against a locked period cannot be corrected; that is the
whole point of locking a period.

**Cancelling.** A bill is never deleted. `cancel` marks it cancelled, with a
reason and a timestamp, and leaves its number consumed forever — the number
has already been seen by the outside world. The documents that were issued are
left exactly as they were issued; a cancellation is recorded beside them, not
painted over them.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from finance.backend.document_types import AMC_INVOICE, SALES_INVOICE
from finance.backend.events.registry import (
    INVOICE_CANCELLED,
    INVOICE_DELETED,
    INVOICE_GENERATED,
    INVOICE_UPDATED,
)
from finance.backend.models.invoice import (
    Customer,
    Invoice,
    InvoiceLine,
    InvoiceStatus,
    InvoiceType,
    LifecycleStage,
    PaymentStatus,
)
from finance.backend.services import computation, pdf, renderer
from finance.backend.services.numbering import (
    InvoiceNumberingService,
    financial_year_for,
    format_invoice_number,
)
from finance.backend.services.words import rupees_in_words
from periods.resolution import DocumentContext, resolve_location
from periods.services import PeriodService
from shared.events import publish
from shared.exceptions import ConflictError, ValidationError
from shared.services import BaseService
from storage.providers import LocalStorageProvider, get_provider
from storage.services import StorageService, safe_filename

DOCUMENT_TYPE_BY_INVOICE_TYPE = {
    InvoiceType.AMC: AMC_INVOICE,
    InvoiceType.SALES: SALES_INVOICE,
}

PREVIEW_WATERMARK = "PREVIEW"


class InvoiceService(BaseService):
    # ------------------------------------------------------------------ #
    # Shared preparation — preview, generate and update must agree
    # exactly, so all three go through this.
    # ------------------------------------------------------------------ #
    def _prepare(
        self,
        *,
        tenant,
        invoice_type: str,
        invoice_date: date,
        lines: list[dict],
        customer: Customer | None,
        consignee_name: str = "",
        consignee_address: str = "",
        facility: str = "",
        gstin: str = "",
        is_sez: bool | None = None,
        gst_rate: Decimal | None = None,
        period_year: int | None = None,
        period_month: int | None = None,
    ) -> dict[str, Any]:
        if invoice_type not in InvoiceType.values:
            raise ValidationError(detail={"invoice_type": ["Unknown invoice type."]})

        computed_lines = computation.compute_lines(lines)
        if not computed_lines or not any(line.description for line in computed_lines):
            raise ValidationError(detail={"lines": ["At least one line item is required."]})

        sez = customer.is_sez if is_sez is None and customer else bool(is_sez)
        tax_mode = computation.tax_mode_for(is_sez=sez)
        rate = Decimal(str(gst_rate)) if gst_rate is not None else computation.DEFAULT_GST_RATE
        totals = computation.compute_totals(computed_lines, tax_mode=tax_mode, gst_rate=rate)

        period_text = ""
        resolved_year: int | None = None
        resolved_month: int | None = None
        if invoice_type == InvoiceType.AMC:
            resolved_year, resolved_month = computation.billing_period(
                invoice_date=invoice_date, period_year=period_year, period_month=period_month
            )
            period_text = computation.amc_period_text(resolved_year, resolved_month)

        financial_year = financial_year_for(invoice_date)
        return {
            "tenant": tenant,
            "invoice_type": invoice_type,
            "invoice_date": invoice_date,
            "financial_year": financial_year,
            "customer": customer,
            "consignee_name": (consignee_name or (customer.name if customer else "")).strip(),
            "consignee_address": (
                consignee_address or (customer.address if customer else "")
            ).strip(),
            "facility": (facility or (customer.facility if customer else "")).strip(),
            "gstin": (gstin or (customer.gstin if customer else "")).strip(),
            "is_sez": sez,
            "tax_mode": tax_mode,
            "gst_rate": rate,
            "period_year": resolved_year,
            "period_month": resolved_month,
            "period_text": period_text,
            "lines": computed_lines,
            "totals": totals,
            "amount_in_words": rupees_in_words(totals.total),
        }

    def _assert_period_open(self, *, tenant, invoice_date: date) -> None:
        """A bill is filed against the month of its own date; once that month
        has been locked (figures submitted), it stops moving."""
        PeriodService().assert_open(tenant=tenant, year=invoice_date.year, month=invoice_date.month)

    # ------------------------------------------------------------------ #
    # Preview — computes everything generation would, reserves nothing.
    # ------------------------------------------------------------------ #
    def preview(self, **kwargs) -> dict[str, Any]:
        prepared = self._prepare(**kwargs)
        next_number = InvoiceNumberingService().peek(
            tenant=prepared["tenant"], financial_year=prepared["financial_year"]
        )
        prepared["sequence_number"] = next_number
        prepared["number"] = format_invoice_number(next_number, prepared["financial_year"])
        return prepared

    def preview_document(self, **kwargs) -> bytes:
        """The actual invoice as a PDF, watermarked PREVIEW, before anything is
        committed. Takes no number and writes no file — the number shown is the
        one the next generation *would* take."""
        prepared = self.preview(**kwargs)
        workbook = (
            self._render_workbook(prepared, number=prepared["number"])
            if settings.INVOICE_PDF_ENGINE == pdf.ENGINE_LIBREOFFICE
            else None
        )
        return self._render_pdf(
            prepared, number=prepared["number"], workbook=workbook, watermark=PREVIEW_WATERMARK
        )

    # ------------------------------------------------------------------ #
    # Raising
    # ------------------------------------------------------------------ #
    def generate(self, *, actor=None, **kwargs) -> Invoice:
        prepared = self._prepare(**kwargs)
        tenant = prepared["tenant"]
        self._assert_period_open(tenant=tenant, invoice_date=prepared["invoice_date"])

        with transaction.atomic():
            sequence_number = InvoiceNumberingService().reserve(
                tenant=tenant, financial_year=prepared["financial_year"]
            )
            number = format_invoice_number(sequence_number, prepared["financial_year"])
            totals = prepared["totals"]

            invoice = Invoice.objects.create(
                tenant=tenant,
                invoice_type=prepared["invoice_type"],
                number=number,
                financial_year=prepared["financial_year"],
                sequence_number=sequence_number,
                invoice_date=prepared["invoice_date"],
                customer=prepared["customer"],
                consignee_name=prepared["consignee_name"],
                consignee_address=prepared["consignee_address"],
                facility=prepared["facility"],
                gstin=prepared["gstin"],
                is_sez=prepared["is_sez"],
                tax_mode=prepared["tax_mode"],
                gst_rate=prepared["gst_rate"],
                period_year=prepared["period_year"],
                period_month=prepared["period_month"],
                period_text=prepared["period_text"],
                subtotal=totals.subtotal,
                cgst_amount=totals.cgst_amount,
                sgst_amount=totals.sgst_amount,
                igst_amount=totals.igst_amount,
                round_off=totals.round_off,
                total=totals.total,
                amount_in_words=prepared["amount_in_words"],
                generated_by=actor,
            )
            self._write_lines(invoice=invoice, lines=prepared["lines"])
            self._attach_documents(invoice=invoice, prepared=prepared, actor=actor)

        self._record(
            invoice=invoice,
            actor=actor,
            action="finance.invoice_generated",
            event=INVOICE_GENERATED,
            extra={},
        )
        return invoice

    # ------------------------------------------------------------------ #
    # Correcting
    # ------------------------------------------------------------------ #
    def update(self, *, invoice: Invoice, actor=None, **kwargs) -> Invoice:
        """Recomputes and regenerates a bill under its existing number."""
        if invoice.status != InvoiceStatus.ISSUED:
            raise ConflictError("A cancelled invoice cannot be corrected.")

        prepared = self._prepare(tenant=invoice.tenant, **kwargs)
        # Both the month it was filed under and the month it is moving to must
        # be open, or a locked period could be edited out from under itself.
        self._assert_period_open(tenant=invoice.tenant, invoice_date=invoice.invoice_date)
        self._assert_period_open(tenant=invoice.tenant, invoice_date=prepared["invoice_date"])

        if prepared["financial_year"] != invoice.financial_year:
            raise ConflictError(
                "Moving an invoice into another financial year would change its number. "
                "Cancel it and raise a new one instead."
            )

        before = {
            "consignee_name": invoice.consignee_name,
            "tax_mode": invoice.tax_mode,
            "total": str(invoice.total),
            "invoice_date": invoice.invoice_date.isoformat(),
        }
        totals = prepared["totals"]

        with transaction.atomic():
            invoice.invoice_type = prepared["invoice_type"]
            invoice.invoice_date = prepared["invoice_date"]
            invoice.customer = prepared["customer"]
            invoice.consignee_name = prepared["consignee_name"]
            invoice.consignee_address = prepared["consignee_address"]
            invoice.facility = prepared["facility"]
            invoice.gstin = prepared["gstin"]
            invoice.is_sez = prepared["is_sez"]
            invoice.tax_mode = prepared["tax_mode"]
            invoice.gst_rate = prepared["gst_rate"]
            invoice.period_year = prepared["period_year"]
            invoice.period_month = prepared["period_month"]
            invoice.period_text = prepared["period_text"]
            invoice.subtotal = totals.subtotal
            invoice.cgst_amount = totals.cgst_amount
            invoice.sgst_amount = totals.sgst_amount
            invoice.igst_amount = totals.igst_amount
            invoice.round_off = totals.round_off
            invoice.total = totals.total
            invoice.amount_in_words = prepared["amount_in_words"]
            invoice.revision += 1
            invoice.save()

            invoice.lines.all().hard_delete()
            self._write_lines(invoice=invoice, lines=prepared["lines"])

            superseded = [invoice.file, invoice.pdf_file]
            self._attach_documents(invoice=invoice, prepared=prepared, actor=actor)
            for stored in superseded:
                if stored is not None:
                    StorageService().delete(stored, actor=actor)

        self._record(
            invoice=invoice,
            actor=actor,
            action="finance.invoice_corrected",
            event=INVOICE_UPDATED,
            extra={"revision": invoice.revision, "before": before},
        )
        return invoice

    # ------------------------------------------------------------------ #
    # Cancelling
    # ------------------------------------------------------------------ #
    def cancel(self, *, invoice: Invoice, actor=None, reason: str) -> Invoice:
        if invoice.status == InvoiceStatus.CANCELLED:
            raise ConflictError("This invoice is already cancelled.")
        if not reason.strip():
            raise ValidationError(detail={"reason": ["A cancellation reason is required."]})
        self._assert_period_open(tenant=invoice.tenant, invoice_date=invoice.invoice_date)

        invoice.status = InvoiceStatus.CANCELLED
        invoice.cancelled_at = timezone.now()
        invoice.cancellation_reason = reason.strip()
        invoice.save(update_fields=["status", "cancelled_at", "cancellation_reason", "updated_at"])
        self._record(
            invoice=invoice,
            actor=actor,
            action="finance.invoice_cancelled",
            event=INVOICE_CANCELLED,
            extra={"reason": invoice.cancellation_reason},
        )
        return invoice

    # ------------------------------------------------------------------ #
    # Deleting
    # ------------------------------------------------------------------ #
    def delete(self, *, invoice: Invoice, actor=None) -> None:
        """Retracts a bill that never left the building.

        Only a freshly generated invoice can be deleted — one that has not been
        sent, paid, gone overdue or been cancelled (`LifecycleStage.GENERATED`).
        Once a bill has been seen by the outside world it is cancelled, never
        removed: cancelling keeps the row, records a reason and leaves the
        issued documents untouched. Deleting destroys the stored workbook and
        PDF for good, so it is reserved for a bill raised by mistake and caught
        before it went anywhere.

        The number is not released either way. The row is soft-deleted and
        `InvoiceNumberingService` counts soft-deleted rows when it allocates, so
        the statutory sequence keeps no hole and no number is handed out twice.
        """
        stage = invoice.lifecycle_stage()
        if stage != LifecycleStage.GENERATED:
            raise ConflictError(
                f"This invoice is {LifecycleStage(stage).label.lower()} and can no longer be "
                "deleted — the customer has already seen it. Cancel it instead, which keeps "
                "the bill and its number on the register with a reason."
            )
        self._assert_period_open(tenant=invoice.tenant, invoice_date=invoice.invoice_date)
        from audit.services import AuditService
        from finance.backend.search.adapter import INDEX as SEARCH_INDEX
        from search.services import SearchService

        with transaction.atomic():
            superseded = [invoice.file, invoice.pdf_file]
            for stored in superseded:
                if stored is not None:
                    StorageService().delete(stored, actor=actor)

            AuditService().record(
                action="finance.invoice_deleted",
                module="finance",
                object_type="Invoice",
                object_id=str(invoice.id),
                changes={
                    "number": invoice.number,
                    "consignee": invoice.consignee_name,
                    "total": str(invoice.total),
                },
                actor=actor,
                tenant=invoice.tenant,
            )
            SearchService().remove(
                index=SEARCH_INDEX, doc_id=str(invoice.id), tenant=invoice.tenant
            )
            publish(INVOICE_DELETED, instance=invoice, actor=actor)
            invoice.delete()

    # ------------------------------------------------------------------ #
    # Lifecycle — orthogonal to the register status (issued/cancelled). These
    # never touch the number, the sequence, or the documents; they record where
    # a raised bill is in its collection life (sent → paid), and a due date so
    # "overdue" can be derived. A cancelled bill has no lifecycle to move.
    # ------------------------------------------------------------------ #
    def set_due_date(self, *, invoice: Invoice, due_date, actor=None) -> Invoice:
        self._assert_live(invoice)
        invoice.due_date = due_date
        invoice.save(update_fields=["due_date", "updated_at"])
        self._audit_lifecycle(invoice, actor, "finance.invoice_due_date_set")
        return invoice

    def mark_sent(self, *, invoice: Invoice, actor=None) -> Invoice:
        self._assert_live(invoice)
        if invoice.sent_at is None:
            invoice.sent_at = timezone.now()
            invoice.save(update_fields=["sent_at", "updated_at"])
            self._audit_lifecycle(invoice, actor, "finance.invoice_sent")
        return invoice

    def mark_paid(self, *, invoice: Invoice, actor=None) -> Invoice:
        self._assert_live(invoice)
        if invoice.payment_status != PaymentStatus.PAID:
            invoice.payment_status = PaymentStatus.PAID
            invoice.paid_at = timezone.now()
            invoice.save(update_fields=["payment_status", "paid_at", "updated_at"])
            self._audit_lifecycle(invoice, actor, "finance.invoice_paid")
        return invoice

    def unmark_paid(self, *, invoice: Invoice, actor=None) -> Invoice:
        """Reverses a mistaken payment confirmation."""
        self._assert_live(invoice)
        if invoice.payment_status != PaymentStatus.UNPAID:
            invoice.payment_status = PaymentStatus.UNPAID
            invoice.paid_at = None
            invoice.save(update_fields=["payment_status", "paid_at", "updated_at"])
            self._audit_lifecycle(invoice, actor, "finance.invoice_payment_reversed")
        return invoice

    @staticmethod
    def _assert_live(invoice: Invoice) -> None:
        if invoice.status == InvoiceStatus.CANCELLED:
            raise ConflictError("A cancelled invoice has no lifecycle to update.")

    def _audit_lifecycle(self, invoice: Invoice, actor, action: str) -> None:
        from audit.services import AuditService
        from finance.backend.search.adapter import INDEX as SEARCH_INDEX
        from finance.backend.search.adapter import to_document as search_document
        from search.services import SearchService

        AuditService().record(
            action=action,
            module="finance",
            object_type="Invoice",
            object_id=str(invoice.id),
            changes={
                "number": invoice.number,
                "payment_status": invoice.payment_status,
                "lifecycle_stage": invoice.lifecycle_stage(),
            },
            actor=actor,
            tenant=invoice.tenant,
        )
        SearchService().upsert(
            index=SEARCH_INDEX, tenant=invoice.tenant, **search_document(invoice)
        )

    # ------------------------------------------------------------------ #
    # Rendering & storage
    # ------------------------------------------------------------------ #
    def _write_lines(self, *, invoice: Invoice, lines) -> None:
        InvoiceLine.objects.bulk_create(
            [
                InvoiceLine(
                    invoice=invoice,
                    position=line.position,
                    description=line.description,
                    hsn=line.hsn,
                    quantity=line.quantity,
                    uom=line.uom,
                    rate=line.rate,
                    amount=line.amount,
                )
                for line in lines
            ]
        )

    def _render_workbook(self, prepared: dict[str, Any], *, number: str) -> bytes:
        return renderer.render_invoice(
            number=number,
            invoice_date=prepared["invoice_date"],
            consignee_name=prepared["consignee_name"],
            consignee_address=prepared["consignee_address"],
            facility=prepared["facility"],
            lines=prepared["lines"],
            totals=prepared["totals"],
            tax_mode=prepared["tax_mode"],
            gst_rate=prepared["gst_rate"],
            amount_in_words=prepared["amount_in_words"],
            period_text=prepared["period_text"],
        )

    def _render_pdf(
        self,
        prepared: dict[str, Any],
        *,
        number: str,
        workbook: bytes | None,
        watermark: str = "",
    ) -> bytes:
        return pdf.build_invoice_pdf(
            xlsx_bytes=workbook,
            number=number,
            invoice_date=prepared["invoice_date"],
            consignee_name=prepared["consignee_name"],
            consignee_address=prepared["consignee_address"],
            facility=prepared["facility"],
            gstin=prepared["gstin"],
            lines=prepared["lines"],
            totals=prepared["totals"],
            tax_mode=prepared["tax_mode"],
            gst_rate=prepared["gst_rate"],
            amount_in_words=prepared["amount_in_words"],
            period_text=prepared["period_text"],
            watermark=watermark,
        )

    def _attach_documents(self, *, invoice: Invoice, prepared: dict[str, Any], actor) -> None:
        """Renders the workbook and the PDF, files both, and points the invoice
        at them. Called on both first issue and correction."""
        workbook = self._render_workbook(prepared, number=invoice.number)
        document = self._render_pdf(prepared, number=invoice.number, workbook=workbook)

        stem = invoice.number.replace("/", "-")
        customer_slug = slugify(invoice.consignee_name)[:40]
        suffix = f"_{customer_slug}" if customer_slug else ""

        stored_workbook, workbook_path = self._file(
            invoice=invoice,
            actor=actor,
            data=workbook,
            filename=f"{stem}{suffix}.xlsx",
            content_type=renderer.CONTENT_TYPE,
        )
        try:
            stored_pdf, pdf_path = self._file(
                invoice=invoice,
                actor=actor,
                data=document,
                filename=f"{stem}{suffix}.pdf",
                content_type=pdf.CONTENT_TYPE,
            )
        except Exception:
            # The workbook is already on the provider but the transaction is
            # about to roll back, which would leave its bytes behind with no
            # register row pointing at them. Take them with us.
            StorageService().delete(stored_workbook, actor=actor)
            raise

        invoice.file, invoice.local_path = stored_workbook, workbook_path
        invoice.pdf_file, invoice.pdf_local_path = stored_pdf, pdf_path
        invoice.save(
            update_fields=["file", "local_path", "pdf_file", "pdf_local_path", "updated_at"]
        )

    def _file(self, *, invoice: Invoice, actor, data: bytes, filename: str, content_type: str):
        """Files one artifact under the business-period path the platform
        already uses for every other document — `<tenant>/<year>/<Month>/
        <AMC|Sales Invoices>/<name>` — and makes sure a copy is on local disk."""
        document_type = DOCUMENT_TYPE_BY_INVOICE_TYPE[invoice.invoice_type]
        resolved = resolve_location(
            DocumentContext(
                document_type=document_type,
                document_name=safe_filename(filename),
                tenant_slug=invoice.tenant.slug,
                business_date=invoice.invoice_date,
                source_channel="finance.invoice",
            )
        )
        stored = StorageService().store(
            data=data,
            filename=filename,
            content_type=content_type,
            module="finance",
            category=document_type,
            tenant=invoice.tenant,
            uploaded_by=actor,
            key=resolved.key,
            period_year=resolved.period_year,
            period_month=resolved.period_month,
            is_library=resolved.is_library,
            metadata={
                "invoice_number": invoice.number,
                "invoice_type": invoice.invoice_type,
                "revision": invoice.revision,
            },
            # System-generated: allow exactly the types this path produces
            # rather than depending on the general upload allowlist.
            allowed_types={renderer.CONTENT_TYPE, pdf.CONTENT_TYPE},
        )
        PeriodService().record_document(
            tenant=invoice.tenant, resolved=resolved, document_type=document_type
        )
        return stored, self._mirror_locally(key=stored.key, data=data, content_type=content_type)

    def _mirror_locally(self, *, key: str, data: bytes, content_type: str) -> str:
        """The operator keeps their own books: an invoice must exist as a file
        on their machine, not only in whatever object store is configured. So
        the same `LocalStorageProvider` the platform uses in local mode is
        pointed at `INVOICE_LOCAL_ARCHIVE_PATH` and written to as well — no new
        storage system, one configurable root. When the platform is already
        storing locally at that root, the bytes are there and this is a no-op.
        """
        archive = LocalStorageProvider(settings.INVOICE_LOCAL_ARCHIVE_PATH)
        primary = get_provider()
        already_written = isinstance(primary, LocalStorageProvider) and primary.root == archive.root
        if not already_written:
            archive.put(key, data, content_type)
        return str(Path(archive.root) / key)

    # ------------------------------------------------------------------ #
    # Audit trail
    # ------------------------------------------------------------------ #
    def _record(
        self, *, invoice: Invoice, actor, action: str, event: str, extra: dict[str, Any]
    ) -> None:
        from audit.services import AuditService
        from finance.backend.search.adapter import INDEX as SEARCH_INDEX
        from finance.backend.search.adapter import to_document as search_document
        from search.services import SearchService

        AuditService().record(
            action=action,
            module="finance",
            object_type="Invoice",
            object_id=str(invoice.id),
            changes={
                "number": invoice.number,
                "invoice_type": invoice.invoice_type,
                "consignee": invoice.consignee_name,
                "tax_mode": invoice.tax_mode,
                "total": str(invoice.total),
                "status": invoice.status,
                **extra,
            },
            actor=actor,
            tenant=invoice.tenant,
        )
        # Keep the search index in step with the register (generate/correct/
        # cancel all pass through here). A cancelled bill stays indexed with its
        # new status rather than disappearing.
        SearchService().upsert(
            index=SEARCH_INDEX, tenant=invoice.tenant, **search_document(invoice)
        )
        publish(event, instance=invoice, actor=actor)
