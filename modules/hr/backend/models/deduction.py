"""Deduction — advances, fines, damages and loans against an employee.

Migrated from the legacy app's `Deduction`. Maps directly onto Form XXIX
(Deduction sheet) and Form C (Register of Unpaid Wages) in the statutory
workbook.

NOTE: an employee marked "Left" with an unrecovered deduction must still
appear in Form C — that is what `is_recovered` controls, so do not filter
these rows by employee status.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class DeductionType(models.TextChoices):
    """Types as Form XXIX names them."""

    ADVANCE = "Advance", "Advance"
    FINE = "Fine", "Fine"
    DAMAGE = "Damage", "Damage"
    LOAN = "Loan", "Loan"
    OTHER = "Other", "Other"


class Deduction(TenantOwnedModel):
    employee = models.ForeignKey("hr.Employee", on_delete=models.CASCADE, related_name="deductions")
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    type = models.CharField(
        max_length=20, choices=DeductionType.choices, default=DeductionType.ADVANCE
    )

    # Advance fields
    date_of_payment = models.DateField(null=True, blank=True)
    amount = models.FloatField(default=0.0)
    installments = models.PositiveSmallIntegerField(null=True, blank=True)
    recovery_date = models.DateField(null=True, blank=True)

    # Recovery tracking, for partial recovery across installments
    recovery_amount = models.FloatField(default=0.0)
    is_recovered = models.BooleanField(default=False)

    # Damage / loss fields
    damage_description = models.TextField(blank=True)
    showcause_date = models.DateField(null=True, blank=True)

    # Fine fields
    act_or_omission = models.TextField(blank=True)

    description = models.TextField(blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_deduction"
        indexes = [
            models.Index(fields=["employee", "year", "month"]),
            models.Index(fields=["tenant", "year", "month"]),
            models.Index(fields=["tenant", "is_recovered"]),
        ]

    def __str__(self) -> str:
        return f"Deduction({self.employee_id}, {self.type}, {self.amount})"

    @property
    def outstanding_amount(self) -> float:
        return max(0.0, self.amount - self.recovery_amount)
