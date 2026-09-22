"""HRMSUploadLog — immutable record of generated client HRMS upload packages.

Tracks generated version per month, stored file references, input attendance hash,
and soft warnings.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class HRMSUploadLog(TenantOwnedModel):
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    version = models.PositiveIntegerField()
    client_code = models.CharField(max_length=50, default="167948248")

    # SHA-256 hash of the attendance grid input state for idempotency checking
    attendance_hash = models.CharField(max_length=64, db_index=True, blank=True)

    stored_hrms = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_upload_hrms_files",
    )
    stored_attendance = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_upload_attendance_files",
    )
    stored_leave = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_upload_leave_files",
    )
    stored_paysheet = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_upload_paysheet_files",
    )

    warnings = models.JSONField(default=list, blank=True)

    generated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_uploads_generated",
    )
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_hrms_upload_log"
        ordering = ("-year", "-month", "-version")
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "year", "month", "version"],
                name="uniq_hrms_upload_version_per_month",
            ),
        ]
        indexes = [models.Index(fields=["tenant", "year", "month"])]

    def __str__(self) -> str:
        return f"HRMSUpload({self.year}-{self.month:02d} v{self.version})"
