"""Business period read API serializers."""

from __future__ import annotations

from rest_framework import serializers
from shared.serializers import BaseModelSerializer

from periods.models import BusinessPeriod, PeriodManifest


class PeriodManifestSerializer(BaseModelSerializer):
    class Meta:
        model = PeriodManifest
        fields = ("document_counts", "total_count", "updated_at")
        read_only_fields = fields


class BusinessPeriodSerializer(BaseModelSerializer):
    # A period can exist with no manifest yet (e.g. get_or_create_period
    # called directly, before any document was ever recorded) — a plain
    # nested serializer would raise on the missing reverse OneToOne.
    manifest = serializers.SerializerMethodField()

    class Meta:
        model = BusinessPeriod
        fields = (
            "id",
            "year",
            "month",
            "status",
            "closed_at",
            "is_locked",
            "locked_at",
            "unlock_reason",
            "unlocked_at",
            "manifest",
            "created_at",
        )
        read_only_fields = fields

    def get_manifest(self, obj: BusinessPeriod) -> dict:
        manifest = getattr(obj, "manifest", None)
        if manifest is None:
            return {"document_counts": {}, "total_count": 0, "updated_at": None}
        return PeriodManifestSerializer(manifest).data


class UnlockPeriodSerializer(serializers.Serializer):
    """Unlocking a period always carries a reason — it becomes the audit
    record of why already-submitted figures were reopened."""

    reason = serializers.CharField(allow_blank=False)
