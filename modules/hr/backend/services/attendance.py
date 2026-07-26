"""Attendance grid read and bulk save.

Migrated from the legacy app's attendance API. The behaviours the grid depends
on are preserved exactly:

- Late-entry / early-exit flags are **derived on read**, never stored, so a
  change to the shift definitions is reflected in history immediately.
- A blank status on save means "unmark this day" — the row is removed.
- A Present day submitted with no swipe times gets the shift's standard In/Out
  filled in automatically.
- `worked_hours` and the daily `ot_hours` are computed once at save time via
  shift_rules, because monthly OT downstream is SUM(daily OT).
- An explicit `ot_hours` from the client wins over the computed value (the grid
  lets the operator override a day's OT).
"""

from __future__ import annotations

from audit.services import AuditService
from django.db import transaction
from periods.services import PeriodService
from shared import context

from hr.backend.repositories import AttendanceRepository, EmployeeRepository
from hr.backend.services.shift_rules import SHIFT_DEFINITIONS, normalize_shift, validate_swipe

MODULE = "hr"


class AttendanceService:
    def __init__(self) -> None:
        self.attendance = AttendanceRepository()
        self.employees = EmployeeRepository()
        self.audit = AuditService()

    def month_grid(self, year: int, month: int) -> dict:
        """The full month for every employee who was on the rolls in it."""
        employees = list(self.employees.employees_for_month(year, month))
        records = self.attendance.month_all_employees(year, month)

        by_employee: dict = {}
        for r in records:
            has_swipes = bool(r.in_time and r.out_time)
            # Derived, not stored — recompute for display.
            check = validate_swipe(r.shift, r.in_time, r.out_time)
            by_employee.setdefault(r.employee_id, {})[r.day] = {
                "day": r.day,
                "status": r.status,
                "shift": r.shift,
                "in_time": r.in_time,
                "out_time": r.out_time,
                "worked_hours": r.worked_hours,
                "ot_hours": r.ot_hours,
                "late_entry": check.late_entry if has_swipes else None,
                "early_exit": check.early_exit if has_swipes else None,
            }

        rows = [
            {
                "employee_id": emp.pk,
                "employee_code": emp.employee_code,
                "employee_name": emp.employee_name,
                "department": emp.department,
                "shift": normalize_shift(emp.shift),
                "days": by_employee.get(emp.pk, {}),
            }
            for emp in employees
        ]

        return {"year": year, "month": month, "rows": rows}

    @transaction.atomic
    def save_grid(self, *, year: int, month: int, records: list[dict]) -> int:
        """Apply a bulk grid edit. Returns the number of day-cells touched.

        Refuses to write into a locked month: once a month's registers have been
        generated and submitted, the attendance behind those figures must not
        change silently. Unlocking needs an explicit reason (platform/periods).
        """
        PeriodService().assert_open(tenant=context.current_tenant(), year=year, month=month)

        tenant_id = context.current_tenant_id()

        # The employee master's shift is the fallback when a day has none.
        employees = self.employees.employees_for_month(year, month)
        default_shifts = {emp.pk: normalize_shift(emp.shift) for emp in employees}

        touched = 0
        for record in records:
            employee_id = record["employee_id"]
            default_shift = default_shifts.get(employee_id, "G")

            for day_entry in record["days"]:
                shift = normalize_shift(day_entry.get("shift") or default_shift)
                status = (day_entry.get("status") or "").strip()

                # Empty status: the operator is clearing the cell.
                if not status:
                    self.attendance.delete_day(employee_id, year, month, day_entry["day"])
                    touched += 1
                    continue

                in_time = day_entry.get("in_time") or ""
                out_time = day_entry.get("out_time") or ""

                # Present with no times: fill in the shift's standard window.
                if status == "P" and not in_time and not out_time:
                    sdef = SHIFT_DEFINITIONS.get(shift)
                    if sdef:
                        in_time = sdef.expected_in
                        out_time = sdef.expected_out

                check = validate_swipe(shift, in_time, out_time)
                has_swipes = bool(in_time and out_time)

                # An explicit OT from the client wins over the computed value.
                submitted_ot = day_entry.get("ot_hours")
                final_ot = (
                    submitted_ot
                    if submitted_ot is not None
                    else (check.ot_hours if has_swipes else None)
                )

                self.attendance.upsert_day(
                    employee_id=employee_id,
                    tenant_id=tenant_id,
                    year=year,
                    month=month,
                    day=day_entry["day"],
                    status=status,
                    in_time=in_time,
                    out_time=out_time,
                    shift=shift,
                    worked_hours=check.worked_hours if has_swipes else None,
                    ot_hours=final_ot,
                )
                touched += 1

        self.audit.record(
            action="hr.attendance.bulk_updated",
            module=MODULE,
            object_type="Attendance",
            changes={"period": f"{year}-{month:02d}", "cells": touched},
        )
        return touched
