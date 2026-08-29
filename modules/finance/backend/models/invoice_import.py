"""Staging for the bulk historical-invoice import.

A batch of already-issued invoices is uploaded as scans, read by OCR in the
background, reviewed and corrected by the operator, and then **committed** into
the real bill register (`Invoice`) one row at a time, each keeping its original
printed number. Nothing here is the register itself — these are the holding pen
where a scan becomes a trusted draft before it earns a place on the register.

Two things are deliberate:

1. **The OCR payload is kept forever, untouched.** `raw_extraction` is what the
   model actually read; `proposed` is the operator's editable draft seeded from
   it. Keeping both means a correction is auditable ("the model read X, the
   operator changed it to Y") and a batch can be re-derived if the mapping
   improves.

2. **A file can appear in a batch only once.** The `(tenant, batch, content_hash)`
   uniqueness lets an interrupted upload be retried safely — the same scan sent
   twice is one item, not two.
"""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class InvoiceImportBatchStatus(models.TextChoices):
    PROCESSING = "processing", "Processing"  # OCR still running on some items
    REVIEW = "review", "In review"  # OCR done; awaiting the operator
    COMPLETED = "completed", "Completed"  # every item committed or discarded
    ARCHIVED = "archived", "Archived"


class InvoiceImportItemStatus(models.TextChoices):
    QUEUED = "queued", "Queued"  # stored, waiting for the OCR pipeline
    PROCESSING = "processing", "Processing"  # OCR in flight
    EXTRACTED = "extracted", "Ready to review"  # OCR done, confident enough
    NEEDS_ATTENTION = "needs_attention", "Needs attention"  # low confidence / gaps
    COMMITTED = "committed", "Committed"  # became a register Invoice
    FAILED = "failed", "Failed"  # OCR errored after retries
    DISCARDED = "discarded", "Discarded"  # operator dropped it


# Terminal states an item cannot leave.
IMPORT_ITEM_TERMINAL = frozenset(
    {InvoiceImportItemStatus.COMMITTED, InvoiceImportItemStatus.DISCARDED}
)
# States whose OCR has resolved and that the operator can act on.
IMPORT_ITEM_REVIEWABLE = frozenset(
    {InvoiceImportItemStatus.EXTRACTED, InvoiceImportItemStatus.NEEDS_ATTENTION}
)


class InvoiceImportBatch(TenantOwnedModel):
    """One bulk upload — the cohort a set of historical invoices came in as, so an
    import is reportable as a unit ("the FY 2026-27 back-fill")."""

    label = models.CharField(max_length=200, blank=True, default="")
    status = models.CharField(
        max_length=12,
        choices=InvoiceImportBatchStatus.choices,
        default=InvoiceImportBatchStatus.PROCESSING,
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoice_import_batches",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "finance_invoice_import_batch"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.label or f"Import {self.created_at:%Y-%m-%d}"


class InvoiceImportItem(TenantOwnedModel):
    """One uploaded scan on its way to becoming a register `Invoice`."""

    batch = models.ForeignKey(InvoiceImportBatch, on_delete=models.CASCADE, related_name="items")
    # The original scan. PROTECT so its bytes cannot be hard-deleted out from
    # under an item that still points at them; StorageService soft-deletes, which
    # PROTECT does not block.
    source_file = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.PROTECT,
        related_name="invoice_import_items",
    )
    original_filename = models.CharField(max_length=255, blank=True, default="")
    content_hash = models.CharField(max_length=64, db_index=True)

    status = models.CharField(
        max_length=16,
        choices=InvoiceImportItemStatus.choices,
        default=InvoiceImportItemStatus.QUEUED,
        db_index=True,
    )

    # What the model read (immutable) and the operator's editable draft seeded
    # from it. `proposed` matches the GenerateInvoiceSerializer shape plus
    # `number`, so committing is a straight hand-off to the invoice service.
    raw_extraction = models.JSONField(default=dict, blank=True)
    proposed = models.JSONField(default=dict, blank=True)

    # Denormalized from `proposed` on save — cheap to sort/filter/dedupe on, and
    # what the review grid lists without unpacking JSON per row.
    proposed_number = models.CharField(max_length=60, blank=True, default="")
    proposed_invoice_date = models.DateField(null=True, blank=True)
    proposed_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    confidence_score = models.DecimalField(max_digits=4, decimal_places=3, default=Decimal("0.000"))

    error_message = models.TextField(blank=True, default="")
    run_id = models.CharField(max_length=64, blank=True, default="")

    # Set when the item is committed — the register row it produced.
    invoice = models.ForeignKey(
        "finance.Invoice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_items",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "finance_invoice_import_item"
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "batch", "content_hash"],
                condition=models.Q(is_deleted=False),
                name="uniq_finance_import_item_hash",
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "batch"]),
        ]

    def __str__(self) -> str:
        return self.proposed_number or self.original_filename or str(self.id)
