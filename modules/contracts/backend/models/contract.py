"""The Contract — a company agreement with a counterparty, its lifecycle, and
an optional signed file.

Like Documents, every heavy capability it needs is a platform service: the
signed PDF lives in `storage.StoredFile`, approval runs on the platform
workflow engine, the summary comes from the AI gateway. The module owns only
the contract's meaning (parties, dates, value, renewal). Vendors are a plain
`counterparty` string — there is no Vendors module, and modules never import
one another, so a cross-module FK would be wrong here anyway.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone
from shared.models import TenantOwnedModel


class ContractCategory(models.TextChoices):
    SERVICE = "service", "Service agreement"
    LEASE = "lease", "Lease"
    NDA = "nda", "NDA"
    EMPLOYMENT = "employment", "Employment"
    SUPPLY = "supply", "Supply"
    LICENSE = "license", "License"
    OTHER = "other", "Other"


class ContractStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    ACTIVE = "active", "Active"
    EXPIRED = "expired", "Expired"
    TERMINATED = "terminated", "Terminated"


class SummaryStatus(models.TextChoices):
    NONE = "none", "Not generated"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"


class Contract(TenantOwnedModel):
    title = models.CharField(max_length=200)
    counterparty = models.CharField(max_length=200, help_text="The other party / supplier.")
    category = models.CharField(
        max_length=20,
        choices=ContractCategory.choices,
        default=ContractCategory.OTHER,
        db_index=True,
    )
    status = models.CharField(
        max_length=20, choices=ContractStatus.choices, default=ContractStatus.DRAFT, db_index=True
    )

    value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="USD")

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True, db_index=True)
    auto_renew = models.BooleanField(default=False)
    renewal_notice_days = models.PositiveIntegerField(default=30)

    notes = models.TextField(blank=True, default="")

    # Optional signed document, stored in platform storage (never a raw path).
    file = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contracts",
    )

    ai_summary = models.TextField(blank=True, default="")
    summary_status = models.CharField(
        max_length=20, choices=SummaryStatus.choices, default=SummaryStatus.NONE
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contracts",
    )
    terminated_at = models.DateTimeField(null=True, blank=True)
    termination_reason = models.CharField(max_length=300, blank=True, default="")

    class Meta(TenantOwnedModel.Meta):
        db_table = "contracts_contract"
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "end_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} · {self.counterparty}"

    @property
    def days_to_expiry(self) -> int | None:
        if self.end_date is None:
            return None
        return (self.end_date - timezone.now().date()).days

    @property
    def is_expiring_soon(self) -> bool:
        days = self.days_to_expiry
        return (
            self.status == ContractStatus.ACTIVE
            and days is not None
            and 0 <= days <= self.renewal_notice_days
        )
