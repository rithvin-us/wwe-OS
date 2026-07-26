"""Deduction data access.

Migrated from the legacy app's `DeductionRepository`.
"""

from __future__ import annotations

from django.db import models
from shared.repositories import BaseRepository

from hr.backend.models import Deduction


class DeductionRepository(BaseRepository[Deduction]):
    model = Deduction

    def by_month(self, year: int, month: int) -> models.QuerySet[Deduction]:
        return (
            self.filter(year=year, month=month)
            .select_related("employee")
            .order_by("employee__employee_code")
        )

    def for_employee_month(self, employee_id, year: int, month: int) -> models.QuerySet[Deduction]:
        return self.filter(employee_id=employee_id, year=year, month=month).order_by("type")

    def for_employee(self, employee_id) -> models.QuerySet[Deduction]:
        return self.filter(employee_id=employee_id).order_by("-year", "-month")
