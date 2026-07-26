"""The DB-touching side of platform/periods: period rows, the manifest
cache, and lifecycle status. Deliberately separate from periods.resolution
(pure) — see design §9a:
docs/superpowers/specs/2026-07-24-business-period-manager-design.md
"""

from __future__ import annotations

from django.db.models import Count
from django.utils import timezone
from shared import context
from shared.exceptions import ConflictError, ValidationError
from shared.services import BaseService
from storage.models import StoredFile

from periods.models import BusinessPeriod, PeriodManifest, PeriodStatus
from periods.resolution import ResolvedLocation


class PeriodService(BaseService):
    def get_or_create_period(self, *, tenant, year: int, month: int) -> BusinessPeriod:
        period, _created = BusinessPeriod.objects.get_or_create(
            tenant=tenant, year=year, month=month
        )
        return period

    def record_document(self, *, tenant, resolved: ResolvedLocation, document_type: str) -> None:
        """Call AFTER StorageService.store() succeeds — never before, so a
        failed upload never leaves an orphaned period/manifest entry."""
        if resolved.is_library:
            return
        period = self.get_or_create_period(
            tenant=tenant, year=resolved.period_year, month=resolved.period_month
        )
        self.refresh_manifest(period=period)

    def refresh_manifest(self, *, period: BusinessPeriod) -> PeriodManifest:
        """Always recomputed from a live StoredFile aggregate — never a
        running counter — so it self-heals after an out-of-band edit or
        delete (design §9c)."""
        rows = (
            StoredFile.objects.filter(
                tenant=period.tenant, period_year=period.year, period_month=period.month
            )
            .values("category")
            .annotate(count=Count("id"))
        )
        document_counts = {row["category"]: row["count"] for row in rows if row["category"]}
        total_count = sum(document_counts.values())
        manifest, _created = PeriodManifest.objects.update_or_create(
            tenant=period.tenant,
            period=period,
            defaults={"document_counts": document_counts, "total_count": total_count},
        )
        return manifest

    def list_periods(self, *, tenant) -> list[BusinessPeriod]:
        return list(BusinessPeriod.objects.filter(tenant=tenant).order_by("-year", "-month"))

    def set_status(self, *, period: BusinessPeriod, status: str) -> BusinessPeriod:
        if status not in PeriodStatus.values:
            raise ValidationError(detail={"status": ["Unknown period status."]})
        period.status = status
        period.save(update_fields=["status", "updated_at"])
        return period

    # ----------------------------------------------------------------- locking

    def lock(self, *, tenant, year: int, month: int, actor=None) -> BusinessPeriod:
        """Close a period to further writes.

        Called after a module has produced the authoritative output for the
        month (e.g. a statutory register workbook), so the figures behind that
        output cannot drift afterwards. Idempotent: locking a locked period is
        a no-op, not an error.
        """
        period = self.get_or_create_period(tenant=tenant, year=year, month=month)
        if period.is_locked:
            return period

        period.is_locked = True
        period.locked_at = timezone.now()
        period.locked_by = actor or context.current_user()
        period.status = PeriodStatus.CLOSED
        period.closed_at = period.locked_at
        period.save(
            update_fields=[
                "is_locked",
                "locked_at",
                "locked_by",
                "status",
                "closed_at",
                "updated_at",
            ]
        )
        return period

    def unlock(self, *, tenant, year: int, month: int, reason: str, actor=None) -> BusinessPeriod:
        """Reopen a locked period. The reason is mandatory and audit-critical —
        it is the record of why already-submitted figures were reopened."""
        if not (reason or "").strip():
            raise ValidationError(detail={"reason": ["A reason is required to unlock a period."]})

        period = self.get_or_create_period(tenant=tenant, year=year, month=month)
        if not period.is_locked:
            return period

        period.is_locked = False
        period.unlock_reason = reason.strip()
        period.unlocked_at = timezone.now()
        period.unlocked_by = actor or context.current_user()
        period.status = PeriodStatus.OPEN
        period.closed_at = None
        period.save(
            update_fields=[
                "is_locked",
                "unlock_reason",
                "unlocked_at",
                "unlocked_by",
                "status",
                "closed_at",
                "updated_at",
            ]
        )
        return period

    def is_locked(self, *, tenant, year: int, month: int) -> bool:
        """Whether the period is locked. A period that has never been created
        is open — absence of a row is not a lock."""
        return BusinessPeriod.objects.filter(
            tenant=tenant, year=year, month=month, is_locked=True
        ).exists()

    def assert_open(self, *, tenant, year: int, month: int) -> None:
        """Guard for any write to data filed against a business period.

        Modules call this before mutating month-scoped business data. Raising
        here rather than returning a boolean means a caller cannot forget to
        check the result.
        """
        if self.is_locked(tenant=tenant, year=year, month=month):
            raise ConflictError(
                f"Period {year}-{month:02d} is locked. Unlock it with a reason before editing."
            )
