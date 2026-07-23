"""Automation API serializers."""

from __future__ import annotations

from rest_framework import serializers
from shared.serializers import BaseModelSerializer

from automation.models import AutomationRule, AutomationRun


class AutomationRuleSerializer(BaseModelSerializer):
    class Meta:
        model = AutomationRule
        fields = (
            "id",
            "name",
            "description",
            "source_modules",
            "required_tags",
            "destination",
            "report_key",
            "export_format",
            "cadence",
            "next_run_at",
            "last_run_at",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "last_run_at", "created_at", "updated_at")


class AutomationRuleWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    source_modules = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    required_tags = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    destination = serializers.ChoiceField(
        choices=AutomationRule._meta.get_field("destination").choices
    )
    report_key = serializers.CharField(required=False, allow_blank=True, default="")
    export_format = serializers.ChoiceField(
        choices=["csv", "xlsx", "pdf", "html"], required=False, default="csv"
    )
    cadence = serializers.ChoiceField(
        choices=AutomationRule._meta.get_field("cadence").choices, required=False, default="once"
    )
    next_run_at = serializers.DateTimeField()
    is_active = serializers.BooleanField(required=False, default=True)


class AutomationRunSerializer(BaseModelSerializer):
    filename = serializers.SerializerMethodField()
    report_export_id = serializers.SerializerMethodField()

    class Meta:
        model = AutomationRun
        fields = (
            "id",
            "rule",
            "rule_name",
            "destination",
            "status",
            "triggered_by",
            "started_at",
            "finished_at",
            "item_count",
            "items",
            "filename",
            "report_export_id",
            "error_message",
            "created_at",
        )
        read_only_fields = fields

    def get_filename(self, obj: AutomationRun) -> str | None:
        return obj.output_file.filename if obj.output_file else None

    def get_report_export_id(self, obj: AutomationRun) -> str | None:
        return str(obj.report_export_id) if obj.report_export_id else None
