"""SalaryRule — per-employee wage structure, effective-dated.

Migrated from the legacy app's `SalaryRule`. Holds only the split of an
employee's declared monthly wage into Basic / DA / HRA / Medical /
Conveyance (Form XXVII columns N–R). Statutory *rates* (PF %, ESI %, caps)
are global and live in `PayRulesConfig`, not here.

Effective dating exists so a past month can always be recalculated with the
structure that was in force then.

Payroll skips any employee with no effective salary rule — that is the
legacy behaviour and it is intentional: no declared structure means no
defensible wage figures for a register.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class WageType(models.TextChoices):
    MONTHLY = "Monthly", "Monthly"
    DAILY = "Daily", "Daily"


class SalaryRule(TenantOwnedModel):
    employee = models.ForeignKey(
        "hr.Employee",
        on_delete=models.CASCADE,
        related_name="salary_rules",
        null=True,
        blank=True,
    )
    wage_type = models.CharField(max_length=20, choices=WageType.choices, default=WageType.MONTHLY)

    # Declared monthly wage components. Float, not Decimal — see the note on
    # Employee.salary.
    basic = models.FloatField(default=0.0)
    da = models.FloatField(default=0.0)
    hra = models.FloatField(default=0.0)
    medical_allowance = models.FloatField(default=0.0)
    conveyance_allowance = models.FloatField(default=0.0)

    # Per-hour OT rate override. 0 means "derive it": total salary / standard
    # days / standard hours.
    ot_rate = models.FloatField(default=0.0)

    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_salary_rule"
        indexes = [
            models.Index(fields=["employee", "effective_from"]),
            models.Index(fields=["tenant", "effective_from"]),
        ]

    def __str__(self) -> str:
        return f"SalaryRule({self.employee_id}, total={self.total_monthly_salary})"

    @property
    def total_monthly_salary(self) -> float:
        return self.basic + self.da + self.hra + self.medical_allowance + self.conveyance_allowance
