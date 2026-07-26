"""Payroll read and run.

Thin orchestration around `PayrollEngine` — all the arithmetic lives in the
migrated engine, which must stay the only place that computes wages.
"""

from __future__ import annotations

from audit.services import AuditService
from periods.services import PeriodService
from shared import context

from hr.backend.repositories import PayrollRepository
from hr.backend.services.payroll_engine import PayrollEngine

MODULE = "hr"


class PayrollService:
    def __init__(self) -> None:
        self.payroll = PayrollRepository()
        self.audit = AuditService()

    def month_summary(self, year: int, month: int) -> dict:
        records = list(self.payroll.by_month(year, month))
        return {
            "year": year,
            "month": month,
            "total_employees": len(records),
            "total_gross": round(sum(r.gross_salary for r in records), 2),
            "total_pf": round(sum(r.pf_deduction for r in records), 2),
            "total_esi": round(sum(r.esi_deduction for r in records), 2),
            "total_deductions": round(sum(r.total_deductions for r in records), 2),
            "total_net": round(sum(r.net_salary for r in records), 2),
            "records": records,
        }

    def run(self, year: int, month: int) -> list:
        """(Re)calculate the month. Replaces any existing figures for it.

        Blocked on a locked month — recalculating would change figures that
        have already been submitted in a statutory register.
        """
        PeriodService().assert_open(tenant=context.current_tenant(), year=year, month=month)

        records = PayrollEngine().generate_payroll(year, month)

        self.audit.record(
            action="hr.payroll.generated",
            module=MODULE,
            object_type="Payroll",
            changes={"period": f"{year}-{month:02d}", "employees": len(records)},
        )
        return records
