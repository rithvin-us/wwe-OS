"""Backup run ledger — the application-side record of backup activity.

This app does **not** perform backups; the actual pg_dump / object-store sync is
infrastructure (a cron, a managed Postgres snapshot, an R2 lifecycle rule). What
lives here is the honest record of what that infrastructure reported: each run's
kind, outcome, size, where it landed, and — critically — whether it has ever
been *restore-tested*. A run is "verified" only when `verified_at` is set by an
actual restore test; nothing here lets the dashboard claim a backup is safe on
the strength of the backup having merely completed.
"""

from __future__ import annotations

from django.db import models
from shared.models import BaseModel


class BackupKind(models.TextChoices):
    DATABASE = "database", "Database"
    DOCUMENTS = "documents", "Documents / object storage"
    METADATA = "metadata", "Metadata"


class BackupStatus(models.TextChoices):
    RUNNING = "running", "Running"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"


class BackupRun(BaseModel):
    kind = models.CharField(max_length=20, choices=BackupKind.choices, db_index=True)
    status = models.CharField(max_length=20, choices=BackupStatus.choices, db_index=True)
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    size_bytes = models.BigIntegerField(null=True, blank=True)
    # Where the artifact lives (e.g. an R2 key or snapshot id) — never a
    # credential, just a locator the operator can act on.
    location = models.CharField(max_length=500, blank=True, default="")
    message = models.TextField(blank=True, default="")
    # Set only by an actual restore test — the difference between "a backup ran"
    # and "a backup we know we can restore".
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        db_table = "backups_backup_run"
        ordering = ("-started_at",)
        indexes = [models.Index(fields=["kind", "status", "started_at"])]

    def __str__(self) -> str:
        return f"{self.kind} {self.status} @ {self.started_at:%Y-%m-%d %H:%M}"
