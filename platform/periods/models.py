"""Business period storage — a lazily-created anchor row per (tenant, year,
month) and a manifest cache of document counts against it. The manifest is
never the source of truth: PeriodService.refresh_manifest always recomputes
it from a live StoredFile aggregate, never a running counter (see
docs/superpowers/specs/2026-07-24-business-period-manager-design.md §9c).
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class PeriodStatus(models.TextChoices):
    OPEN = "open", "Open"
    ACTIVE = "active", "Active"
    CLOSING = "closing", "Closing"
    CLOSED = "closed", "Closed"
    ARCHIVED = "archived", "Archived"


class BusinessPeriod(TenantOwnedModel):
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()  # 1-12
    status = models.CharField(
        max_length=10, choices=PeriodStatus.choices, default=PeriodStatus.OPEN
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "periods_business_period"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "year", "month"], name="uniq_period_per_tenant"
            )
        ]
        indexes = [models.Index(fields=["tenant", "year", "month"])]

    def __str__(self) -> str:
        return f"{self.year}-{self.month:02d} · {self.status}"


class PeriodManifest(TenantOwnedModel):
    period = models.OneToOneField(BusinessPeriod, on_delete=models.CASCADE, related_name="manifest")
    document_counts = models.JSONField(default=dict, blank=True)
    total_count = models.PositiveIntegerField(default=0)

    class Meta(TenantOwnedModel.Meta):
        db_table = "periods_manifest"

    def __str__(self) -> str:
        return f"manifest · {self.period_id} · {self.total_count}"
