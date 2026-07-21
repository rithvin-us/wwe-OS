"""Reporting export history.

Every rendered export is a row here plus a StoredFile holding the bytes —
the operator can re-download any report exactly as it was generated.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class ExportFormat(models.TextChoices):
    CSV = "csv", "CSV"
    XLSX = "xlsx", "Excel"
    HTML = "html", "HTML"
    PDF = "pdf", "PDF"


class ReportExport(TenantOwnedModel):
    report_key = models.CharField(max_length=100)
    title = models.CharField(max_length=200)
    module = models.CharField(max_length=50)
    format = models.CharField(max_length=10, choices=ExportFormat.choices)
    file = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="report_exports",
    )
    row_count = models.PositiveIntegerField(default=0)
    params = models.JSONField(default=dict, blank=True)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="report_exports",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "reporting_export"
        indexes = [models.Index(fields=["tenant", "module"])]

    def __str__(self) -> str:
        return f"{self.report_key}.{self.format} ({self.row_count} rows)"
