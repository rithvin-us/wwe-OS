"""Backup status — assembled honestly from the run ledger and real storage size.

Never asserts a backup exists or is safe unless the ledger says so: an area
with no successful run is reported as "not configured", and a run is only
"verified" when a restore test set `verified_at`.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.db import models
from django.utils import timezone
from shared.services import BaseService

from backups.models import BackupKind, BackupRun, BackupStatus

# How old the newest successful run may be before an area is flagged stale.
STALE_AFTER = {
    BackupKind.DATABASE: timedelta(days=1),
    BackupKind.DOCUMENTS: timedelta(days=7),
    BackupKind.METADATA: timedelta(days=7),
}


class BackupService(BaseService):
    def record(
        self,
        *,
        kind: str,
        status: str,
        started_at,
        finished_at=None,
        size_bytes: int | None = None,
        location: str = "",
        message: str = "",
        verified: bool = False,
    ) -> BackupRun:
        return BackupRun.objects.create(
            kind=kind,
            status=status,
            started_at=started_at,
            finished_at=finished_at,
            size_bytes=size_bytes,
            location=location,
            message=message,
            verified_at=timezone.now() if verified else None,
        )

    def summary(self, *, user) -> dict[str, Any]:
        return {
            "areas": [self._area(kind) for kind in BackupKind.values],
            "storage": self._storage(user),
            "recent_failures": self._recent_failures(),
        }

    # ------------------------------------------------------------------ #
    def _area(self, kind: str) -> dict[str, Any]:
        last_success = (
            BackupRun.objects.filter(kind=kind, status=BackupStatus.SUCCESS)
            .order_by("-started_at")
            .first()
        )
        last_any = BackupRun.objects.filter(kind=kind).order_by("-started_at").first()
        now = timezone.now()

        if last_success is None:
            # Be explicit: nothing has ever backed this up successfully.
            return {
                "kind": kind,
                "configured": False,
                "status": "not_configured",
                "last_success_at": None,
                "age_days": None,
                "verified": False,
                "last_attempt_status": last_any.status if last_any else None,
            }

        age = now - last_success.started_at
        stale = age > STALE_AFTER.get(kind, timedelta(days=7))
        return {
            "kind": kind,
            "configured": True,
            "status": "stale" if stale else "healthy",
            "last_success_at": last_success.started_at,
            "age_days": age.days,
            "size_bytes": last_success.size_bytes,
            "location": last_success.location,
            # Only true if an actual restore test verified it.
            "verified": last_success.verified_at is not None,
            "verified_at": last_success.verified_at,
            "last_attempt_status": last_any.status if last_any else None,
        }

    @staticmethod
    def _storage(user) -> dict[str, Any]:
        from storage.models import StoredFile

        qs = StoredFile.objects.all()
        if not getattr(user, "is_superuser", False):
            qs = qs.filter(tenant_id=getattr(user, "tenant_id", None))
        agg = qs.aggregate(total=models.Sum("size_bytes"), count=models.Count("id"))
        return {"total_bytes": agg["total"] or 0, "file_count": agg["count"] or 0}

    @staticmethod
    def _recent_failures() -> list[dict[str, Any]]:
        rows = BackupRun.objects.filter(status=BackupStatus.FAILED).order_by("-started_at")[:5]
        return [
            {
                "kind": row.kind,
                "at": row.started_at,
                "message": row.message,
            }
            for row in rows
        ]
