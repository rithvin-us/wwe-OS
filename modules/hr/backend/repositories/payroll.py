"""Payroll data access.

Migrated from the legacy app's `PayrollRepository`. Every read that surfaces
`employee_name` / `employee_code` selects the employee, because those are
derived properties on the model (see `hr.backend.models.payroll`).
"""

from __future__ import annotations

from django.db import models
from shared.repositories import BaseRepository

from hr.backend.models import Payroll


class PayrollRepository(BaseRepository[Payroll]):
    model = Payroll

    def by_month(self, year: int, month: int) -> models.QuerySet[Payroll]:
        return (
            self.filter(year=year, month=month)
            .select_related("employee")
            .order_by("employee__employee_code")
        )

    def for_employee_month(self, employee_id, year: int, month: int) -> Payroll | None:
        return (
            self.filter(employee_id=employee_id, year=year, month=month)
            .select_related("employee")
            .first()
        )

    def delete_month(self, year: int, month: int) -> int:
        """Clear a month before regenerating it.

        Hard delete, matching legacy. A soft-deleted row would keep occupying
        the (employee, year, month) unique constraint, so the regenerated row
        could never be written.
        """
        deleted, _ = self.filter(year=year, month=month).hard_delete()
        return deleted
