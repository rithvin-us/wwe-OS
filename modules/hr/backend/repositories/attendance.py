"""Attendance data access.

Migrated from the legacy app's `AttendanceRepository`.
"""

from __future__ import annotations

from django.db import models
from shared.repositories import BaseRepository

from hr.backend.models import Attendance


class AttendanceRepository(BaseRepository[Attendance]):
    model = Attendance

    def month_for_employee(self, employee_id, year: int, month: int) -> models.QuerySet[Attendance]:
        return self.filter(employee_id=employee_id, year=year, month=month).order_by("day")

    def month_all_employees(self, year: int, month: int) -> models.QuerySet[Attendance]:
        return (
            self.filter(year=year, month=month)
            .select_related("employee")
            .order_by("employee__employee_code", "day")
        )

    def upsert_day(
        self,
        *,
        employee_id,
        year: int,
        month: int,
        day: int,
        status: str,
        in_time: str = "",
        out_time: str = "",
        shift: str = "G",
        worked_hours: float | None = None,
        ot_hours: float | None = None,
        tenant_id=None,
    ) -> Attendance:
        """Create or update a single day.

        Stores the raw swipes plus the per-day computed `worked_hours` and
        daily `ot_hours` — monthly OT is always the SUM of these daily values.
        """
        record = self.get_or_none(employee_id=employee_id, year=year, month=month, day=day)
        if record is not None:
            record.status = status
            record.shift = shift
            record.in_time = in_time or ""
            record.out_time = out_time or ""
            record.worked_hours = worked_hours
            record.ot_hours = ot_hours
            record.save(
                update_fields=[
                    "status",
                    "shift",
                    "in_time",
                    "out_time",
                    "worked_hours",
                    "ot_hours",
                    "updated_at",
                ]
            )
            return record

        return Attendance.objects.create(
            employee_id=employee_id,
            tenant_id=tenant_id,
            year=year,
            month=month,
            day=day,
            status=status,
            shift=shift,
            in_time=in_time or "",
            out_time=out_time or "",
            worked_hours=worked_hours,
            ot_hours=ot_hours,
        )

    def delete_day(self, employee_id, year: int, month: int, day: int) -> int:
        """Remove one day's record.

        Hard delete, matching legacy. A soft-deleted row would keep occupying
        the (employee, year, month, day) unique constraint and permanently
        block re-entry of that day.
        """
        deleted, _ = self.filter(
            employee_id=employee_id, year=year, month=month, day=day
        ).hard_delete()
        return deleted

    def delete_month_for_employee(self, employee_id, year: int, month: int) -> int:
        """Remove an employee's whole month. Hard delete — see `delete_day`."""
        deleted, _ = self.filter(employee_id=employee_id, year=year, month=month).hard_delete()
        return deleted
