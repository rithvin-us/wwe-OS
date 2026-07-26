"""Employee data access.

Migrated from the legacy app's `EmployeeRepository`. Query semantics are
preserved exactly — particularly `employees_for_month`, whose window
definition decides who appears in a month's payroll and registers.
"""

from __future__ import annotations

from datetime import date

from django.db import models
from shared.repositories import BaseRepository

from hr.backend.models import Employee, EmployeeStatus

# Employees on the rolls. "Left" is excluded; "New Joining" is not, because a
# joiner must appear in the month they start.
ON_ROLL_STATUSES = (EmployeeStatus.ACTIVE, EmployeeStatus.NEW_JOINING)


class EmployeeRepository(BaseRepository[Employee]):
    model = Employee

    def get_by_code(self, code: str) -> Employee | None:
        return self.get_or_none(employee_code=code)

    def active_employees(self) -> models.QuerySet[Employee]:
        return self.filter(status__in=ON_ROLL_STATUSES).order_by("employee_code")

    def enrolled_employees(self) -> models.QuerySet[Employee]:
        """On-roll employees with a stored face template.

        This is the candidate set for 1:N check-in identification. Legacy
        checked `face_embedding IS NOT NULL`; the migrated column is blank-not-
        null, so the equivalent test is "not empty".
        """
        return (
            self.filter(status__in=ON_ROLL_STATUSES)
            .exclude(face_embedding="")
            .order_by("employee_code")
        )

    def employees_for_month(self, year: int, month: int) -> models.QuerySet[Employee]:
        """Employees who were on the rolls at any point during the month.

        Joined before the month ended, and either still on the rolls or left
        on/after the month started.
        """
        month_start = date(year, month, 1)
        month_end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

        return (
            self.filter(date_of_joining__lt=month_end)
            .filter(
                models.Q(date_of_leaving__isnull=True) | models.Q(date_of_leaving__gte=month_start)
            )
            .order_by("employee_code")
        )

    def search(self, query: str) -> models.QuerySet[Employee]:
        return (
            self.query()
            .filter(
                models.Q(employee_name__icontains=query) | models.Q(employee_code__icontains=query)
            )
            .order_by("employee_code")
        )

    def count_by_status(self, status: str) -> int:
        return self.filter(status=status).count()
