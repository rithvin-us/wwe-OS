"""The PurchaseBill model — the record a document-ingestion channel (Telegram
today; email/manual upload later) creates, and the operator reviews.

Field shape matches `docs/modules/purchase-integration-requirements.md`
exactly for the ingested fields; everything else supports the review queue.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class SourceChannel(models.TextChoices):
    TELEGRAM = "telegram", "Telegram"
    EMAIL = "email", "Email"
    UPLOAD = "upload", "Manual upload"


class BillStatus(models.TextChoices):
    PROCESSED = "processed", "Processed"
    NEEDS_ATTENTION = "needs_attention", "Needs Attention"


class PaymentStatus(models.TextChoices):
    UNPAID = "unpaid", "Unpaid"
    PAID = "paid", "Paid"


class PurchaseBill(TenantOwnedModel):
    vendor = models.ForeignKey(
        "purchase.Vendor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bills",
    )

    # --- Fields captured verbatim from the ingest contract ---
    seller_name = models.CharField(max_length=200)
    purchase_date = models.DateField()
    total_rate = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    document_url = models.URLField(max_length=500)
    telegram_user_id = models.BigIntegerField(null=True, blank=True)
    telegram_username = models.CharField(max_length=150, blank=True, default="")
    external_ref = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text=(
            "Stable id of the source document (e.g. Telegram file_unique_id). "
            "Ingestion dedupes on it; blank means the channel had none."
        ),
    )

    # --- Ingestion & Storage Service metadata ---
    source_channel = models.CharField(
        max_length=20, choices=SourceChannel.choices, default=SourceChannel.TELEGRAM
    )
    storage_key = models.CharField(max_length=500, blank=True, default="")
    raw_extraction = models.JSONField(
        default=dict,
        blank=True,
        help_text="The full OCR/extraction payload, kept for audit and reprocessing.",
    )

    # --- Structured OCR extraction fields ---
    invoice_number = models.CharField(max_length=100, blank=True, default="")
    invoice_date = models.DateField(null=True, blank=True)
    gst_number = models.CharField(max_length=50, blank=True, default="")
    items = models.JSONField(
        default=list,
        blank=True,
        help_text="Extracted line items: [{item_name, quantity, unit_price, tax, total}]",
    )
    total_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=50, blank=True, default="")
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    is_duplicate = models.BooleanField(default=False)

    # --- Processing status ---
    status = models.CharField(
        max_length=20, choices=BillStatus.choices, default=BillStatus.PROCESSED, db_index=True
    )

    # --- Payment tracking ---
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID, db_index=True
    )
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "purchase_bill"
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "payment_status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "source_channel", "external_ref"],
                name="uniq_bill_external_ref_per_channel",
                condition=~models.Q(external_ref=""),
            ),
        ]

    def __str__(self) -> str:
        return f"{self.seller_name} · {self.currency} {self.total_rate}"
