"""Salary-rule data access.

Migrated from the legacy app's `SalaryRuleRepository`. The effective-rule
lookup keeps both legacy behaviours intact:

1. The target date is the *last* day of the month, so a rule that takes effect
   mid-month applies to that month.
2. If the employee has no rule of their own, a tenant-wide default rule (one
   with no employee attached) is used. Without that fallback, payroll silently
   skips the employee.
"""

from __future__ import annotations

import calendar
from datetime import date

from django.db import models
from shared.repositories import BaseRepository

from hr.backend.models import SalaryRule


class SalaryRuleRepository(BaseRepository[SalaryRule]):
    model = SalaryRule

    def for_employee(self, employee_id) -> models.QuerySet[SalaryRule]:
        return self.filter(employee_id=employee_id).order_by("-effective_from")

    def effective_rule(self, employee_id, year: int, month: int) -> SalaryRule | None:
        _, last_day = calendar.monthrange(year, month)
        target_date = date(year, month, last_day)

        rule = (
            self.filter(employee_id=employee_id, effective_from__lte=target_date)
            .order_by("-effective_from")
            .first()
        )
        if rule is not None:
            return rule

        return (
            self.filter(employee__isnull=True, effective_from__lte=target_date)
            .order_by("-effective_from")
            .first()
        )
