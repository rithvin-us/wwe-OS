from __future__ import annotations

from rest_framework import serializers
from shared.serializers import BaseModelSerializer

from alerts.models import AlertRule, ConditionType, Metric


class AlertRuleSerializer(BaseModelSerializer):
    class Meta:
        model = AlertRule
        fields = (
            "id",
            "name",
            "condition_type",
            "metric",
            "operator",
            "threshold_value",
            "schedule_time",
            "channel",
            "message_template",
            "is_active",
            "last_checked_at",
            "last_triggered_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "last_checked_at",
            "last_triggered_at",
            "created_at",
            "updated_at",
        )


class AlertRuleWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    condition_type = serializers.ChoiceField(choices=ConditionType.choices)
    metric = serializers.ChoiceField(choices=Metric.choices)
    operator = serializers.ChoiceField(
        choices=AlertRule._meta.get_field("operator").choices, required=False, allow_blank=True
    )
    threshold_value = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    schedule_time = serializers.TimeField(required=False, allow_null=True)
    channel = serializers.ChoiceField(
        choices=AlertRule._meta.get_field("channel").choices, required=False, default="telegram"
    )
    message_template = serializers.CharField(
        max_length=300, required=False, allow_blank=True, default=""
    )
    is_active = serializers.BooleanField(required=False, default=True)
