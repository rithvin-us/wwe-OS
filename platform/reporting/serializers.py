"""Reporting API serializers."""

from __future__ import annotations

from rest_framework import serializers
from shared.serializers import BaseModelSerializer

from reporting.models import ReportExport


class ReportExportSerializer(BaseModelSerializer):
    filename = serializers.SerializerMethodField()

    class Meta:
        model = ReportExport
        fields = (
            "id",
            "report_key",
            "title",
            "module",
            "format",
            "row_count",
            "params",
            "filename",
            "created_at",
        )
        read_only_fields = fields

    def get_filename(self, obj: ReportExport) -> str | None:
        return obj.file.filename if obj.file else None
