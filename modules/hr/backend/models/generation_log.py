"""GenerationLog — the immutable record of every statutory workbook produced.

Migrated from the legacy app's `GenerationLog`. Kept as an HR model rather than
folded into `platform/storage` because storage has no notion of *a version per
month*, nor of close/reopen with a mandatory reason — those are
register-compliance facts, not file facts (docs/specs/hr-migration.md § 4).

The bytes, the SHA-256 and integrity verification all live in
`platform/storage` via `stored_file`; this row is the compliance history
pointing at them.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class GenerationStatus(models.TextChoices):
    GENERATED = "generated", "Generated"
    CLOSED = "closed", "Closed"
    REOPENED = "reopened", "Reopened"


class GenerationLog(TenantOwnedModel):
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    # Auto-incremented per (tenant, year, month): v1, v2, … Regenerating a month
    # never overwrites — the earlier submission stays downloadable and verifiable.
    version = models.PositiveIntegerField()

    filename = models.CharField(max_length=255)
    # SHA-256 hex digest, mirrored from the StoredFile so the compliance history
    # is self-describing even if the file is later purged.
    file_hash = models.CharField(max_length=64, db_index=True)
    stored_file = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_generation_logs",
    )

    status = models.CharField(
        max_length=20, choices=GenerationStatus.choices, default=GenerationStatus.GENERATED
    )

    generated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_registers_generated",
    )
    generated_at = models.DateTimeField(auto_now_add=True)

    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_registers_closed",
    )

    # Audit-critical: why was a closed month reopened?
    reopen_reason = models.TextField(blank=True)
    reopened_at = models.DateTimeField(null=True, blank=True)
    reopened_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_registers_reopened",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_generation_log"
        ordering = ("-year", "-month", "-version")
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "year", "month", "version"],
                name="uniq_generation_version_per_month",
            ),
        ]
        indexes = [models.Index(fields=["tenant", "year", "month"])]

    def __str__(self) -> str:
        return f"{self.year}-{self.month:02d} v{self.version} [{self.status}]"
