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
    PENDING_REVIEW = "pending_review", "Pending review"
    CONFIRMED = "confirmed", "Confirmed"
    REJECTED = "rejected", "Rejected"


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
    currency = models.CharField(max_length=3, default="USD")
    document_url = models.URLField(max_length=500)
    telegram_user_id = models.BigIntegerField(null=True, blank=True)

    # --- Ingestion metadata ---
    source_channel = models.CharField(
        max_length=20, choices=SourceChannel.choices, default=SourceChannel.TELEGRAM
    )
    raw_extraction = models.JSONField(
        default=dict,
        blank=True,
        help_text="The full OCR/extraction payload, kept for audit and reprocessing.",
    )

    # --- Review queue state ---
    status = models.CharField(
        max_length=20, choices=BillStatus.choices, default=BillStatus.PENDING_REVIEW, db_index=True
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=300, blank=True)

    # --- Payment tracking (confirmed bills only) ---
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

    def __str__(self) -> str:
        return f"{self.seller_name} · {self.currency} {self.total_rate}"
