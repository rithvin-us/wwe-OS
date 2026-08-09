from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.utils import timezone
from notifications.models import Channel as NotifyChannel
from notifications.services import NotificationService
from roles.models import UserRole
from shared.exceptions import ValidationError
from shared.services import BaseService

from alerts.metrics import contracts_stats, purchase_stats, resolve_metric_value
from alerts.models import THRESHOLD_METRICS, AlertRule, ConditionType, Metric, Operator

_OPERATOR_FN = {
    Operator.GT: lambda value, threshold: value > threshold,
    Operator.GTE: lambda value, threshold: value >= threshold,
    Operator.LT: lambda value, threshold: value < threshold,
    Operator.LTE: lambda value, threshold: value <= threshold,
}


class AlertService(BaseService):
    def validate_rule(self, *, data: dict[str, Any]) -> None:
        """Validates the FULLY MERGED shape of a rule (current values + any
        partial update applied on top) — called by the view for both create
        and partial_update, so a partial edit can never leave a rule in an
        invalid shape (e.g. a threshold rule with no operator)."""
        condition_type = data.get("condition_type")
        if condition_type == ConditionType.THRESHOLD:
            if data.get("metric") not in THRESHOLD_METRICS:
                raise ValidationError(
                    detail={
                        "metric": [
                            "This metric isn't a single number a threshold can compare against."
                        ]
                    }
                )
            if not data.get("operator"):
                raise ValidationError(
                    detail={"operator": ["A threshold rule needs a comparison operator."]}
                )
            if data.get("threshold_value") is None:
                raise ValidationError(
                    detail={
                        "threshold_value": ["A threshold rule needs a value to compare against."]
                    }
                )
        elif condition_type == ConditionType.SCHEDULE:
            if data.get("metric") != Metric.OPERATIONAL_DIGEST:
                raise ValidationError(
                    detail={"metric": ["A schedule rule always sends the operational digest."]}
                )
            if data.get("schedule_time") is None:
                raise ValidationError(
                    detail={"schedule_time": ["A schedule rule needs a time of day to send at."]}
                )

    def check_rule(self, *, rule: AlertRule) -> bool:
        """Evaluate one rule. Returns True if it sent a message just now."""
        if rule.condition_type == ConditionType.SCHEDULE:
            return self._send_digest(rule)
        return self._check_threshold(rule)

    def _check_threshold(self, rule: AlertRule) -> bool:
        value = resolve_metric_value(rule.metric, rule.tenant)
        now = timezone.now()
        if value is None:
            rule.last_checked_at = now
            rule.save(update_fields=["last_checked_at", "updated_at"])
            return False

        threshold = rule.threshold_value or Decimal("0")
        fires = _OPERATOR_FN[rule.operator](value, threshold)
        # Edge-trigger: only send on the false -> true transition, not on
        # every sweep the condition happens to still be true.
        just_triggered = fires and not rule.was_firing

        if just_triggered:
            label = dict(Metric.choices)[rule.metric]
            message = rule.message_template or (
                f"{label} {rule.get_operator_display()} {threshold:g} — now at {value:g}."
            )
            self._send(rule, title=rule.name, body=message)
            rule.last_triggered_at = now

        rule.was_firing = fires
        rule.last_checked_at = now
        rule.save(
            update_fields=["last_checked_at", "last_triggered_at", "was_firing", "updated_at"]
        )
        return just_triggered

    def _send_digest(self, rule: AlertRule) -> bool:
        purchase = purchase_stats(rule.tenant) or {}
        contracts = contracts_stats(rule.tenant) or {}
        lines = [
            f"Purchase bills needing attention: {purchase.get('needs_attention', '—')}",
            f"Unpaid purchase bills: {purchase.get('unpaid', '—')}",
            f"Contracts expiring within 30 days: {contracts.get('expiring_soon', '—')}",
        ]
        body = rule.message_template or "\n".join(lines)
        self._send(rule, title=rule.name, body=body)

        now = timezone.now()
        rule.last_triggered_at = now
        rule.last_checked_at = now
        rule.save(update_fields=["last_checked_at", "last_triggered_at", "updated_at"])
        return True

    def _send(self, rule: AlertRule, *, title: str, body: str) -> None:
        # Single-operator model — the rule's tenant has exactly one Owner,
        # the one destination every alert goes to.
        assignment = (
            UserRole.objects.filter(role__slug="owner", user__tenant=rule.tenant)
            .select_related("user")
            .first()
        )
        if assignment is None:
            return
        NotificationService().create(
            recipient=assignment.user,
            title=title,
            body=body,
            category="alert",
            channel=NotifyChannel.TELEGRAM,
            tenant=rule.tenant,
        )

    def is_due(self, rule: AlertRule, *, now) -> bool:
        if not rule.is_active:
            return False
        if rule.condition_type == ConditionType.THRESHOLD:
            # Every sweep re-checks; check_rule's edge-trigger is what
            # prevents repeat sends while a breach persists.
            return True
        if rule.schedule_time is None:
            return False
        if timezone.localtime(now).time() < rule.schedule_time:
            return False
        # Already sent today — wait for tomorrow.
        already_sent_today = rule.last_triggered_at is not None and (
            timezone.localtime(rule.last_triggered_at).date() == timezone.localtime(now).date()
        )
        return not already_sent_today

    def run_due(self, *, tenant) -> int:
        """Check every active rule for one tenant; returns how many fired."""
        now = timezone.now()
        fired = 0
        for rule in AlertRule.objects.filter(tenant=tenant, is_active=True):
            if self.is_due(rule, now=now) and self.check_rule(rule=rule):
                fired += 1
        return fired
