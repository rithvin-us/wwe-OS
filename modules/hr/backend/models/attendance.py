"""Attendance — one row per employee per day.

Migrated from the legacy app's `Attendance` model.

DESIGN PRINCIPLE (carried over unchanged): raw swipe times are the source of
truth. On save, `worked_hours` and the daily `ot_hours` are computed once via
`hr.backend.services.shift_rules` and stored per day, so monthly OT is always
SUM(daily OT) — never re-derived at month level. Because the raw swipes stay
alongside the derived values, every computed figure can be re-checked in an
audit.
"""

from __future__ import annotations

from datetime import date as date_type

from django.db import models
from shared.models import TenantOwnedModel


class AttendanceStatus(models.TextChoices):
    """Every status code the attendance grid and the registers use.

    These exact strings are read by the payroll engine's status sets and
    written into the statutory forms — do not renumber or rename them.
    """

    PRESENT = "P", "Present"
    ABSENT = "A", "Absent"
    PAID_LEAVE = "PL", "Paid leave"
    CASUAL_LEAVE = "CL", "Casual leave"
    SICK_LEAVE = "SL", "Sick leave"
    NATIONAL_HOLIDAY = "NH", "National holiday"
    WEEKLY_OFF = "WO", "Weekly off"
    COMPENSATORY_OFF = "CO", "Compensatory off"
    HALF_DAY = "HD", "Half day"
    NEW_JOINING = "NJ", "Not yet joined"
    LEFT = "LEFT", "Left"
    LEAVE = "L", "Leave"
    WEEKLY_HOLIDAY = "WH", "Weekly holiday"


class Attendance(TenantOwnedModel):
    employee = models.ForeignKey(
        "hr.Employee", on_delete=models.CASCADE, related_name="attendance_records"
    )
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    day = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=10, choices=AttendanceStatus.choices, default=AttendanceStatus.PRESENT
    )

    # Shift actually worked that day: G (General), M (Morning), E (Evening),
    # N (Night). The grid encodes it into the status value as P-G / P-M / P-E /
    # P-N and the API splits it back out on save.
    shift = models.CharField(max_length=2, default="G")

    # Raw swipe times, "HH:MM". Blank (not null) so the engine's
    # `if not in_time` checks behave identically to the legacy Optional[str].
    in_time = models.CharField(max_length=10, blank=True)
    out_time = models.CharField(max_length=10, blank=True)

    # Per-day values computed by shift_rules at save time. Null means "not yet
    # computed" (legacy rows) and makes the engine fall back to deriving them
    # from the raw swipes — that fallback is deliberate, keep it.
    worked_hours = models.FloatField(null=True, blank=True)
    ot_hours = models.FloatField(null=True, blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_attendance"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "employee", "year", "month", "day"],
                name="uniq_attendance_employee_day",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "year", "month"]),
            models.Index(fields=["employee", "year", "month"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee_id} {self.year}-{self.month:02d}-{self.day:02d}: {self.status}"

    @property
    def record_date(self) -> date_type:
        return date_type(self.year, self.month, self.day)
