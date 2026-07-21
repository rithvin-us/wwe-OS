"""AI usage ledger — one row per gateway call (real, cached, or failed).

This table is the single source for token accounting, cost visibility,
prompt analytics (`use_case` = prompt key), and per-module attribution.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class AIUsage(TenantOwnedModel):
    module = models.CharField(max_length=50)
    use_case = models.CharField(max_length=100, blank=True, default="")
    provider = models.CharField(max_length=30)
    model = models.CharField(max_length=60)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    latency_ms = models.PositiveIntegerField(default=0)
    cache_hit = models.BooleanField(default=False)
    success = models.BooleanField(default=True)
    error = models.CharField(max_length=300, blank=True, default="")
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_calls",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "ai_usage"
        indexes = [
            models.Index(fields=["tenant", "module"]),
            models.Index(fields=["tenant", "model"]),
        ]

    def __str__(self) -> str:
        return f"{self.module}/{self.use_case or 'raw'} → {self.model} (${self.cost_usd})"
