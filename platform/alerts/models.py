"""Operator alert rules: "ping me on Telegram when X" (threshold) or "send
me a summary at this time every day" (schedule). Deliberately small —
metrics are a fixed, curated set (see alerts/metrics.py), not an arbitrary
query builder, so a rule can never accidentally expose data the operator
didn't intend to watch.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class ConditionType(models.TextChoices):
    THRESHOLD = "threshold", "Threshold"
    SCHEDULE = "schedule", "Schedule"


class Metric(models.TextChoices):
    PURCHASE_NEEDS_ATTENTION_COUNT = (
        "purchase_needs_attention_count",
        "Purchase bills needing attention",
    )
    PURCHASE_UNPAID_COUNT = "purchase_unpaid_count", "Unpaid purchase bills"
    CONTRACTS_EXPIRING_COUNT = "contracts_expiring_count", "Contracts expiring within 30 days"
    # Schedule-only — not a single number, sends a summary of every metric above.
    OPERATIONAL_DIGEST = "operational_digest", "Daily operational digest"


# Metrics a THRESHOLD rule may compare against a number. OPERATIONAL_DIGEST
# is schedule-only — it has no single value to compare, so it's excluded here.
THRESHOLD_METRICS = frozenset(
    {
        Metric.PURCHASE_NEEDS_ATTENTION_COUNT,
        Metric.PURCHASE_UNPAID_COUNT,
        Metric.CONTRACTS_EXPIRING_COUNT,
    }
)


class Operator(models.TextChoices):
    GT = "gt", "is more than"
    GTE = "gte", "is at least"
    LT = "lt", "is less than"
    LTE = "lte", "is at most"


class Channel(models.TextChoices):
    TELEGRAM = "telegram", "Telegram"


class AlertRule(TenantOwnedModel):
    name = models.CharField(max_length=200)
    condition_type = models.CharField(max_length=10, choices=ConditionType.choices)
    metric = models.CharField(max_length=40, choices=Metric.choices)

    # THRESHOLD only.
    operator = models.CharField(max_length=3, choices=Operator.choices, blank=True, default="")
    threshold_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    # Edge-trigger state: was the condition already true last time this rule
    # was checked? Without this a threshold that stays breached fires again
    # every sweep — every few minutes, forever — instead of once per
    # breach. Reset to false the moment the value drops back under.
    was_firing = models.BooleanField(default=False)

    # SCHEDULE only — daily, at this time.
    schedule_time = models.TimeField(null=True, blank=True)

    channel = models.CharField(max_length=10, choices=Channel.choices, default=Channel.TELEGRAM)
    # Optional custom text; a generated message is used when this is blank.
    message_template = models.CharField(max_length=300, blank=True, default="")

    is_active = models.BooleanField(default=True, db_index=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "alerts_rule"
        indexes = [models.Index(fields=["tenant", "is_active", "condition_type"])]

    def __str__(self) -> str:
        return self.name
