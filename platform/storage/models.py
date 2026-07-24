"""Object storage metadata.

The provider holds bytes; this table holds truth about them — who stored
what, for which tenant and module, with which hash. `module` and `category`
are opaque vocabulary owned by the calling module (the platform never
interprets them), exactly like `AuditLog.module`.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class ScanStatus(models.TextChoices):
    SKIPPED = "skipped", "Skipped"
    PENDING = "pending", "Pending"
    CLEAN = "clean", "Clean"
    INFECTED = "infected", "Infected"


class StoredFile(TenantOwnedModel):
    key = models.CharField(max_length=500, unique=True)
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size_bytes = models.BigIntegerField()
    sha256 = models.CharField(max_length=64, db_index=True)
    module = models.CharField(max_length=50)
    category = models.CharField(max_length=50, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    # Set only by callers that opt into a human-readable key via
    # platform/periods (see StorageService.store's key= kwarg) — every
    # other caller leaves these at their defaults, unchanged from before
    # platform/periods existed.
    period_year = models.PositiveIntegerField(null=True, blank=True)
    period_month = models.PositiveSmallIntegerField(null=True, blank=True)
    is_library = models.BooleanField(default=False)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stored_files",
    )
    # Virus-scan integration point: a scanner service (future) subscribes to
    # FILE_STORED, downloads, scans, and calls StorageService.mark_scan_result.
    scan_status = models.CharField(
        max_length=20, choices=ScanStatus.choices, default=ScanStatus.SKIPPED
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "storage_file"
        indexes = [
            models.Index(fields=["tenant", "module"]),
            models.Index(fields=["tenant", "sha256"]),
        ]

    def __str__(self) -> str:
        return f"{self.module}/{self.filename} ({self.size_bytes}B)"
