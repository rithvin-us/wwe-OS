"""Employee lifecycle.

Migrated from the legacy app's employees API. The create and offboard paths
carry real side effects that the monthly cycle depends on, and they are
preserved exactly:

- **Create** auto-creates a default salary rule from the total salary. Payroll
  skips employees with no rule, so without this a new joiner would silently
  drop out of the month.
- **Create** back-fills `NJ` (not yet joined) for the days of the joining
  month before the joining date, so the grid and Muster Roll show why those
  days are blank.
- **Offboard** never deletes: status flips to `Left`, `date_of_leaving` is set,
  and the rest of that month is filled with `LEFT`.
"""

from __future__ import annotations

import calendar
from datetime import date

from audit.services import AuditService
from django.db import transaction
from shared import context
from shared.exceptions import ConflictError, ValidationError

from hr.backend.models import Employee, EmployeeStatus
from hr.backend.repositories import (
    AttendanceRepository,
    EmployeeRepository,
    SalaryRuleRepository,
)
from hr.backend.services.onboarding import OnboardingService

# Default wage-component split applied when an employee is created with a total
# salary but no explicit salary rule. Refine per-employee via the salary-rule
# endpoints afterwards.
DEFAULT_SPLIT = {
    "basic": 0.50,
    "da": 0.25,
    "hra": 0.15,
    "conveyance_allowance": 0.06,
    "medical_allowance": 0.04,
}

MODULE = "hr"


class EmployeeService:
    def __init__(self) -> None:
        self.employees = EmployeeRepository()
        self.attendance = AttendanceRepository()
        self.salary_rules = SalaryRuleRepository()
        self.audit = AuditService()

    def _index(self, employee: Employee) -> None:
        """Keep the platform search index in step with the employee master, so
        a person is reachable from the command palette. Same service-layer
        pattern the other modules use; an offboarded employee stays indexed
        with its LEFT status rather than disappearing."""
        from search.services import SearchService

        from hr.backend.search.adapter import INDEX, to_document

        SearchService().upsert(index=INDEX, tenant=employee.tenant, **to_document(employee))

    @transaction.atomic
    def create(self, data: dict) -> Employee:
        if self.employees.get_by_code(data["employee_code"]) is not None:
            raise ConflictError("Employee code already exists.")

        tenant_id = context.current_tenant_id()
        employee = Employee.objects.create(tenant_id=tenant_id, **data)

        # Default salary rule, so payroll can run for this employee immediately.
        if employee.salary and employee.salary > 0:
            components = {
                key: round(employee.salary * pct, 2) for key, pct in DEFAULT_SPLIT.items()
            }
            self.salary_rules.model.objects.create(
                tenant_id=tenant_id,
                employee=employee,
                wage_type="Monthly",
                effective_from=employee.date_of_joining,
                **components,
            )

        # Days of the joining month before the joining date are "not yet joined".
        self._backfill_pre_joining(employee, tenant_id)

        self._run_checklist(employee, "onboarding")

        self.audit.record(
            action="hr.employee.created",
            module=MODULE,
            object_type="Employee",
            object_id=str(employee.pk),
            changes={"employee_code": employee.employee_code, "name": employee.employee_name},
        )
        self._index(employee)
        return employee

    @transaction.atomic
    def update(self, employee: Employee, data: dict) -> Employee:
        for key, value in data.items():
            setattr(employee, key, value)
        employee.save()

        self.audit.record(
            action="hr.employee.updated",
            module=MODULE,
            object_type="Employee",
            object_id=str(employee.pk),
            changes=dict(data),
        )
        self._index(employee)
        return employee

    @transaction.atomic
    def offboard(self, employee: Employee, date_of_leaving: date) -> Employee:
        """Mark an employee as having left. Never deletes the record."""
        if date_of_leaving < employee.date_of_joining:
            raise ValidationError("Date of leaving cannot be before date of joining.")

        employee.status = EmployeeStatus.LEFT
        employee.date_of_leaving = date_of_leaving
        employee.save(update_fields=["status", "date_of_leaving", "updated_at"])

        self._fill_post_leaving(employee, date_of_leaving)
        self._run_checklist(employee, "offboarding", anchor_date=date_of_leaving)

        self.audit.record(
            action="hr.employee.offboarded",
            module=MODULE,
            object_type="Employee",
            object_id=str(employee.pk),
            changes={"date_of_leaving": str(date_of_leaving)},
        )
        self._index(employee)
        return employee

    # ----------------------------------------------------------------- helpers

    def _backfill_pre_joining(self, employee: Employee, tenant_id) -> None:
        doj = employee.date_of_joining
        if not doj or doj.day <= 1:
            return
        for day in range(1, doj.day):
            self.attendance.upsert_day(
                employee_id=employee.pk,
                tenant_id=tenant_id,
                year=doj.year,
                month=doj.month,
                day=day,
                status="NJ",
                shift=employee.shift,
                worked_hours=0.0,
                ot_hours=0.0,
            )

    def _fill_post_leaving(self, employee: Employee, date_of_leaving: date) -> None:
        _, last_day = calendar.monthrange(date_of_leaving.year, date_of_leaving.month)
        for day in range(date_of_leaving.day + 1, last_day + 1):
            self.attendance.upsert_day(
                employee_id=employee.pk,
                tenant_id=employee.tenant_id,
                year=date_of_leaving.year,
                month=date_of_leaving.month,
                day=day,
                status="LEFT",
                shift=employee.shift,
                worked_hours=0.0,
                ot_hours=0.0,
            )

    def _run_checklist(
        self, employee: Employee, kind: str, anchor_date: date | None = None
    ) -> None:
        """Generate the standard onboarding/offboarding checklist.

        Idempotent per (employee, workflow), so a repeated hook is harmless.
        """
        OnboardingService().generate_for_employee(
            employee=employee, workflow=kind, anchor_date=anchor_date
        )
