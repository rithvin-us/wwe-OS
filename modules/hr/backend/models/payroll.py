"""Payroll — one computed result row per employee per month.

Migrated from the legacy app's `Payroll`. Every figure here is produced by
`hr.backend.services.payroll_engine`; this model only persists it. Re-running
a month replaces that month's rows.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class Payroll(TenantOwnedModel):
    employee = models.ForeignKey(
        "hr.Employee", on_delete=models.CASCADE, related_name="payroll_records"
    )
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()

    # Days breakdown
    present_days = models.IntegerField(default=0)
    leave_days = models.IntegerField(default=0)
    holiday_days = models.IntegerField(default=0)
    holiday_working_days = models.IntegerField(default=0)
    week_off_days = models.IntegerField(default=0)
    total_paid_days = models.IntegerField(default=0)
    absent_days = models.IntegerField(default=0)

    # Monthly OT = SUM(daily OT stored on Attendance).
    ot_hours = models.FloatField(default=0.0)

    # Wages earned, pro-rated over the standard days. Float, not Decimal — see
    # the note on Employee.salary.
    basic_earned = models.FloatField(default=0.0)
    da_earned = models.FloatField(default=0.0)
    hra_earned = models.FloatField(default=0.0)
    medical_allowance = models.FloatField(default=0.0)
    conveyance_allowance = models.FloatField(default=0.0)
    nfh_wages = models.FloatField(default=0.0)
    ot_earned = models.FloatField(default=0.0)
    leave_wages = models.FloatField(default=0.0)
    bonus_earned = models.FloatField(default=0.0)
    arrear = models.FloatField(default=0.0)

    gross_salary = models.FloatField(default=0.0)

    # Deductions
    pf_deduction = models.FloatField(default=0.0)
    esi_deduction = models.FloatField(default=0.0)
    professional_tax = models.FloatField(default=0.0)
    lwf = models.FloatField(default=0.0)
    advance_deduction = models.FloatField(default=0.0)
    damage_deduction = models.FloatField(default=0.0)
    other_deductions = models.FloatField(default=0.0)
    total_deductions = models.FloatField(default=0.0)

    # Approved expense claims for the month, reimbursed with the salary.
    # Added AFTER deductions and never into gross, so the PF/ESI bases are
    # unaffected. See PayrollEngine.
    expense_reimbursement = models.FloatField(default=0.0)

    # Net, inclusive of expense_reimbursement.
    net_salary = models.FloatField(default=0.0)

    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_payroll"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "employee", "year", "month"],
                name="uniq_payroll_employee_month",
            ),
        ]
        indexes = [models.Index(fields=["tenant", "year", "month"])]

    def __str__(self) -> str:
        return f"Payroll({self.employee_id}, {self.year}-{self.month:02d}, net={self.net_salary})"

    # Employee identity is derived from the relationship, never duplicated into
    # columns, so payroll always reflects the current Employee Master (a rename
    # in the master shows up in every past month's view). Repositories
    # select_related("employee") to keep this from becoming an N+1.
    @property
    def employee_name(self) -> str:
        return self.employee.employee_name

    @property
    def employee_code(self) -> str:
        return self.employee.employee_code
