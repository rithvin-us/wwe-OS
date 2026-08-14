"""The outgoing bill register — AMC and Sales invoices, and the billing
master they are raised against.

Three things in this file are load-bearing and deliberate:

1. **`Invoice` is the bill register.** Not a cache of one: the uniqueness of
   `(tenant, financial_year, sequence_number)` and of `(tenant, number)` is
   enforced by the database, so a duplicate bill number is impossible even if
   two requests race. Soft-deleted invoices keep their rows — a cancelled bill
   still consumed its number, and re-issuing it would put two different
   documents into the world under one number.

2. **Every customer field is snapshotted onto the invoice.** A bill is a legal
   record of what was stated on the day it was raised; editing the master
   afterwards must not rewrite history, so `consignee_name`, `is_sez` and
   friends are copied at generation time and `customer` is only a back-link.

3. **`Customer.is_sez` is the single switch for tax mode.** SEZ supplies are
   inter-state for GST purposes, so they carry IGST; everything else carries
   CGST + SGST. Nothing else in the system decides this.
"""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from shared.models import BaseModel, TenantOwnedModel


class InvoiceType(models.TextChoices):
    AMC = "amc", "AMC"
    SALES = "sales", "Sales"


class TaxMode(models.TextChoices):
    CGST_SGST = "cgst_sgst", "CGST + SGST"
    IGST = "igst", "IGST"


class InvoiceStatus(models.TextChoices):
    ISSUED = "issued", "Issued"
    CANCELLED = "cancelled", "Cancelled"


class PaymentStatus(models.TextChoices):
    UNPAID = "unpaid", "Unpaid"
    PAID = "paid", "Paid"


class LifecycleStage(models.TextChoices):
    """The operator-facing lifecycle, derived (never stored) from the register
    status and the payment layer. Orthogonal to `InvoiceStatus`, which stays the
    legal register state (issued/cancelled) and is never widened."""

    GENERATED = "generated", "Generated"
    SENT = "sent", "Sent"
    PAID = "paid", "Paid"
    OVERDUE = "overdue", "Overdue"
    CANCELLED = "cancelled", "Cancelled"


class Customer(TenantOwnedModel):
    """Billing master: who the bill is addressed to, and which site it covers.

    The operator maintains this; `is_sez` is set here (and nowhere else) so a
    site is classified once rather than re-decided on every invoice.
    """

    name = models.CharField(max_length=200)
    address = models.TextField(blank=True, default="")
    # The site / facility the AMC or supply relates to — printed in the
    # invoice's "Facility:" block. A default for the customer; an invoice may
    # override it.
    facility = models.CharField(max_length=255, blank=True, default="")
    gstin = models.CharField(max_length=20, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    is_sez = models.BooleanField(
        default=False,
        help_text="SEZ sites are billed under IGST; everyone else under CGST + SGST.",
    )
    is_active = models.BooleanField(default=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "finance_customer"
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "name"],
                condition=models.Q(is_deleted=False),
                name="uniq_finance_customer_name",
            )
        ]

    def __str__(self) -> str:
        return self.name


class InvoiceNumberSequence(TenantOwnedModel):
    """One counter per (tenant, financial year) — shared by AMC and Sales.

    Only ever moved forward, and only by `InvoiceNumberingService`, which also
    reconciles it against the highest number actually saved in the register so
    a back-filled or imported invoice can never be handed out twice.
    """

    financial_year = models.CharField(max_length=9)  # "2026-27"
    last_number = models.PositiveIntegerField(default=0)

    class Meta(TenantOwnedModel.Meta):
        db_table = "finance_invoice_sequence"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "financial_year"], name="uniq_finance_sequence_per_year"
            )
        ]

    def __str__(self) -> str:
        return f"{self.financial_year} · {self.last_number}"


class Invoice(TenantOwnedModel):
    invoice_type = models.CharField(max_length=10, choices=InvoiceType.choices)

    # "G/M/12/2026-27" — the printed number, and the parts it is built from.
    number = models.CharField(max_length=60)
    financial_year = models.CharField(max_length=9)
    sequence_number = models.PositiveIntegerField()
    invoice_date = models.DateField()

    customer = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="invoices"
    )
    # --- Snapshots taken at generation time (see module docstring, point 2).
    consignee_name = models.CharField(max_length=200)
    consignee_address = models.TextField(blank=True, default="")
    facility = models.CharField(max_length=255, blank=True, default="")
    gstin = models.CharField(max_length=20, blank=True, default="")
    is_sez = models.BooleanField(default=False)
    tax_mode = models.CharField(max_length=12, choices=TaxMode.choices)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("18.00"))

    # AMC only: the month being billed, and the line printed above the items.
    period_year = models.PositiveIntegerField(null=True, blank=True)
    period_month = models.PositiveSmallIntegerField(null=True, blank=True)
    period_text = models.CharField(max_length=120, blank=True, default="")

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    cgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    sgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    igst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    round_off = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    amount_in_words = models.CharField(max_length=400, blank=True, default="")

    # A raised bill is never deleted — it is cancelled, keeping its number and
    # its place in the sequence. Editing one regenerates the documents under
    # the same number and bumps `revision`, so "which copy is the current one"
    # has an answer.
    status = models.CharField(
        max_length=10, choices=InvoiceStatus.choices, default=InvoiceStatus.ISSUED, db_index=True
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True, default="")
    revision = models.PositiveSmallIntegerField(default=1)

    # --- Lifecycle layer, orthogonal to the register `status` above. An issued
    # bill can be sent to the customer and later paid; overdue is derived from
    # `due_date`. None of this changes the legal register state.
    payment_status = models.CharField(
        max_length=10,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        db_index=True,
    )
    due_date = models.DateField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    file = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="finance_invoices",
    )
    pdf_file = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="finance_invoice_pdfs",
    )
    # Absolute path of the on-disk copy, so the operator can be told exactly
    # where the workbook landed. Populated by InvoiceService; see its
    # `_mirror_locally` for why a local copy always exists.
    local_path = models.CharField(max_length=500, blank=True, default="")
    pdf_local_path = models.CharField(max_length=500, blank=True, default="")
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_invoices",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "finance_invoice"
        ordering = ("-invoice_date", "-sequence_number")
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "financial_year", "sequence_number"],
                name="uniq_finance_invoice_sequence",
            ),
            models.UniqueConstraint(
                fields=["tenant", "number"], name="uniq_finance_invoice_number"
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "invoice_type"]),
            models.Index(fields=["tenant", "invoice_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.number} · {self.consignee_name}"

    def is_overdue(self, *, today=None) -> bool:
        """Unpaid, issued, and past its due date. Derived — never stored, so it
        is always correct for the day it is asked."""
        from datetime import date

        if self.status == InvoiceStatus.CANCELLED:
            return False
        if self.payment_status == PaymentStatus.PAID or self.due_date is None:
            return False
        return self.due_date < (today or date.today())

    def lifecycle_stage(self, *, today=None) -> str:
        """The operator-facing stage, derived from the register status and the
        payment layer. Precedence: cancelled → paid → overdue → sent →
        generated."""
        if self.status == InvoiceStatus.CANCELLED:
            return LifecycleStage.CANCELLED
        if self.payment_status == PaymentStatus.PAID:
            return LifecycleStage.PAID
        if self.is_overdue(today=today):
            return LifecycleStage.OVERDUE
        if self.sent_at is not None:
            return LifecycleStage.SENT
        return LifecycleStage.GENERATED


class InvoiceLine(BaseModel):
    """One printed row of the invoice. Not tenant-owned in its own right — it
    exists only as part of its invoice and is reached through it."""

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    position = models.PositiveSmallIntegerField(default=1)
    description = models.CharField(max_length=500)
    hsn = models.CharField(max_length=20, blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("1.000"))
    uom = models.CharField(max_length=20, blank=True, default="Nos")
    rate = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    class Meta(BaseModel.Meta):
        db_table = "finance_invoice_line"
        ordering = ("position",)

    def __str__(self) -> str:
        return f"{self.position}. {self.description}"
