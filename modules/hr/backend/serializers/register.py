"""Statutory register response shaping."""

from __future__ import annotations

from rest_framework import serializers

from hr.backend.models import GenerationLog


class GenerationLogSerializer(serializers.ModelSerializer):
    generated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GenerationLog
        fields = [
            "id",
            "year",
            "month",
            "version",
            "filename",
            "file_hash",
            "status",
            "generated_by_name",
            "generated_at",
            "closed_at",
            "reopen_reason",
            "reopened_at",
        ]
        read_only_fields = fields

    def get_generated_by_name(self, obj: GenerationLog) -> str:
        actor = obj.generated_by
        return getattr(actor, "username", "") or getattr(actor, "email", "") if actor else ""


class GenerateRegisterSerializer(serializers.Serializer):
    year = serializers.IntegerField(min_value=2020, max_value=2050)
    month = serializers.IntegerField(min_value=1, max_value=12)


class VerifyRegisterSerializer(serializers.Serializer):
    """Result of re-hashing an archived workbook against its recorded digest."""

    valid = serializers.BooleanField()
    filename = serializers.CharField()
    expected_hash = serializers.CharField()
    actual_hash = serializers.CharField()
