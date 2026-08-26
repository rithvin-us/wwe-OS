"""
Payroll Engine

Core salary calculation engine. All business logic for computing
wages, deductions, and net salary lives here.

ARCHITECTURE: The engine is split into two layers:
  1. Pure functions (no DB, no side effects) — independently testable:
     - compute_hours_from_swipe()
     - count_attendance_days()
     - calculate_prorated_wages()
     - calculate_statutory_deductions()
     - calculate_other_deductions()
  2. Orchestrator (PayrollEngine class) — DB-aware:
     - Loads data from repositories
     - Converts ORM models → pure types
     - Calls pure functions
     - Persists results

VERIFIED FORMULAS:
  - Pro-rated wages: (declared_monthly / std_days) × paid_days
  - OT: ot_hours × (total_salary / std_days / std_hours) × ot_multiplier
  - PF: min(ceil(pf_percent × (basic_earned + da_earned)), pf_cap)
  - ESI: min(ceil(esi_percent × gross), esi_cap) — only if gross ≤ esi_wage_ceiling
"""

import logging
import math
from calendar import monthrange
from datetime import date

from django.db import transaction
from django.db.models import Q, Sum
from shared import context

from hr.backend.models import ClaimStatus, Employee, ExpenseClaim, Payroll, PayRulesConfig
from hr.backend.repositories import (
    AttendanceRepository,
    DeductionRepository,
    EmployeeRepository,
    PayrollRepository,
    SalaryRuleRepository,
)
from hr.backend.services.payroll_types import (
    AttendanceRecord,
    DayCounts,
    EmployeeInfo,
    OtherDeductions,
    PayConfig,
    PayrollResult,
    StatutoryDeductions,
    WageBreakdown,
    WageComponents,
)

logger = logging.getLogger(__name__)

# ─── Attendance status sets ───────────────────────────────────────────────────

PRESENT_STATUSES = {"P", "HD"}
LEAVE_STATUSES = {"PL", "CL", "SL", "L", "CO"}
HOLIDAY_STATUSES = {"NH", "WH"}
WEEK_OFF_STATUSES = {"WO", "W/O"}
ABSENT_STATUSES = {"A"}
NON_WORKING_STATUSES = {"NJ", "NEW JOINING", "LEFT", "NEW"}


# ═══════════════════════════════════════════════════════════════════════════════
# PURE FUNCTIONS — No DB access, no side effects, fully testable
# ═══════════════════════════════════════════════════════════════════════════════


def compute_hours_from_swipe(
    in_time: str | None,
    out_time: str | None,
    std_hours: int = 8,
) -> tuple[float, float, list[str]]:
    """
    Compute hours worked and OT from raw swipe times.

    Args:
        in_time: "HH:MM" string or None
        out_time: "HH:MM" string or None
        std_hours: standard hours per day (typically 8)

    Returns:
        (hours_worked, ot_hours, warnings)
        - handles overnight shifts (Out < In → +24h wraparound)
        - missing In or Out → 0 hours with a warning
    """
    warnings = []

    if not in_time or not out_time:
        if in_time and not out_time:
            warnings.append(f"In time {in_time} without Out time — defaulting to 0 hours")
        elif out_time and not in_time:
            warnings.append(f"Out time {out_time} without In time — defaulting to 0 hours")
        return 0.0, 0.0, warnings

    try:
        in_parts = in_time.strip().split(":")
        out_parts = out_time.strip().split(":")
        in_h, in_m = int(in_parts[0]), int(in_parts[1])
        out_h, out_m = int(out_parts[0]), int(out_parts[1])

        in_minutes = in_h * 60 + in_m
        out_minutes = out_h * 60 + out_m

        # Overnight shift: Out time is earlier than In time
        if out_minutes < in_minutes:
            out_minutes += 24 * 60  # +24h wraparound

        total_minutes = out_minutes - in_minutes
        hours_worked = round(total_minutes / 60.0, 2)

        # OT = hours beyond standard day
        ot_hours = max(0.0, round(hours_worked - std_hours, 2))

        return hours_worked, ot_hours, warnings

    except (ValueError, IndexError):
        warnings.append(f"Invalid time format In={in_time} Out={out_time} — defaulting to 0 hours")
        return 0.0, 0.0, warnings


def count_attendance_days(
    attendance: list[AttendanceRecord],
    doj: date,
    dol: date | None,
    year: int,
    month: int,
    std_hours: int = 8,
) -> DayCounts:
    """
    Count attendance days by category, computing hours from raw swipe times.

    Handles mid-month joiners (only counts days ≥ DOJ) and mid-month leavers
    (only counts days ≤ DOL).
    """
    _, days_in_month = monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, days_in_month)

    # Effective window: intersection of [DOJ, DOL] with [month_start, month_end]
    effective_start = max(doj, month_start)
    effective_end = min(dol, month_end) if dol else month_end

    present = 0.0
    leave = 0
    holiday = 0
    week_off = 0
    absent = 0
    half_days = 0
    holiday_working = 0
    ot_hours = 0.0
    warnings = []

    # Build lookup from attendance records
    att_by_day = {r.day: r for r in attendance}

    for day_num in range(1, days_in_month + 1):
        current_date = date(year, month, day_num)

        # Outside the effective employment window
        if current_date < effective_start or current_date > effective_end:
            continue

        record = att_by_day.get(day_num)
        if not record:
            # No attendance record for this day — could be data gap
            continue

        status = record.status.upper().strip()

        if status in PRESENT_STATUSES:
            if status == "HD":
                half_days += 1
                present += 0.5
            else:
                present += 1

            # Monthly OT = SUM(daily OT). Prefer the stored per-day OT
            # (computed via shift_rules at save time); fall back to
            # deriving from raw swipes for legacy rows without it.
            if record.ot_hours is not None:
                ot_hours += record.ot_hours
            else:
                hours, ot, swipe_warnings = compute_hours_from_swipe(
                    record.in_time, record.out_time, std_hours
                )
                warnings.extend(f"Day {day_num}: {w}" for w in swipe_warnings)

        elif status in LEAVE_STATUSES:
            leave += 1
        elif status in HOLIDAY_STATUSES:
            holiday += 1
        elif status in WEEK_OFF_STATUSES:
            week_off += 1
        elif status in ABSENT_STATUSES:
            absent += 1
        # NJ, LEFT, NEW — non-working, already excluded by date window

    # Total paid days: present + leave + holidays + weekly offs
    # (leave is considered paid per plan — PL/CL/SL all count)
    total_paid = present + leave + holiday + week_off

    return DayCounts(
        present=present,
        leave=leave,
        holiday=holiday,
        holiday_working=holiday_working,
        week_off=week_off,
        absent=absent,
        half_days=half_days,
        total_paid=total_paid,
        ot_hours=round(ot_hours, 2),
        warnings=warnings,
    )


def calculate_prorated_wages(
    components: WageComponents,
    days: DayCounts,
    config: PayConfig,
) -> WageBreakdown:
    """
    Calculate pro-rated wages.
    Formula: (declared_monthly / std_days) × paid_days (for each component)
    """
    std_days = config.standard_days_per_month
    std_hours = config.standard_hours_per_day

    # Working days for wage proration = present days only (not holidays/weekoffs)
    # Holidays and week-offs get their own wage line
    working_days = days.present

    # Pro-rate each component: (monthly / std_days) × working_days
    daily_basic = components.basic / std_days
    daily_da = components.da / std_days
    daily_hra = components.hra / std_days
    daily_medical = components.medical_allowance / std_days
    daily_conveyance = components.conveyance_allowance / std_days

    basic = daily_basic * working_days
    da = daily_da * working_days
    hra = daily_hra * working_days
    medical = daily_medical * working_days
    conveyance = daily_conveyance * working_days

    # NFH wages: all holidays on the rolls are paid at the daily rate
    daily_total = components.total_monthly / std_days
    nfh = daily_total * days.holiday if days.holiday > 0 else 0.0

    # Leave wages: paid leave days at the daily rate
    leave_wages = daily_total * days.leave if days.leave > 0 else 0.0

    # OT calculation: ot_hours × rate × multiplier
    ot = 0.0
    if days.ot_hours > 0:
        if components.ot_rate_override > 0:
            ot_rate = components.ot_rate_override
        else:
            ot_rate = components.total_monthly / std_days / std_hours
        ot = days.ot_hours * ot_rate * config.ot_multiplier

    gross = basic + da + hra + medical + conveyance + nfh + ot + leave_wages

    return WageBreakdown(
        basic=round(basic, 2),
        da=round(da, 2),
        hra=round(hra, 2),
        medical=round(medical, 2),
        conveyance=round(conveyance, 2),
        nfh=round(nfh, 2),
        ot=round(ot, 2),
        leave_wages=round(leave_wages, 2),
        gross=round(gross, 2),
    )


def calculate_statutory_deductions(
    wages: WageBreakdown,
    config: PayConfig,
    employee: EmployeeInfo,
) -> StatutoryDeductions:
    """
    Calculate PF and ESI deductions.

    PF: 12% of (basic_earned + da_earned), capped at pf_cap.
        PF applies only if employee has PF number or UAN.
    ESI: 0.75% of gross, capped at esi_cap.
        ESI applies only if employee has ESIC number AND gross ≤ wage ceiling.
    """
    # ── PF: base = Basic earned + DA earned ──
    pf = 0.0
    if employee.pf_number or employee.uan:
        pf_base = wages.basic + wages.da
        pf = math.ceil(pf_base * (config.pf_percent / 100))
        pf = min(pf, config.pf_cap)

    # ── ESI: base = gross wages, with wage ceiling check ──
    esi = 0.0
    if employee.esic_number:  # noqa: SIM102 — kept nested: the two conditions are
        # separate statutory tests (is the employee ESI-registered at all, and is
        # this month's gross within the ceiling), and the else-case comment below
        # documents the second one. Collapsing them loses that.
        if wages.gross <= config.esi_wage_ceiling:
            esi = math.ceil(wages.gross * (config.esi_percent / 100))
            esi = min(esi, config.esi_cap)
        # If gross > ceiling, ESI = 0 (employee is above threshold)

    return StatutoryDeductions(
        pf=round(pf, 2),
        esi=round(esi, 2),
        pt=0.0,  # TODO: implement PT slab lookup from config.pt_slab_json
        lwf=0.0,  # TODO: implement LWF from config
    )


def calculate_other_deductions(
    deductions: list[dict],
) -> OtherDeductions:
    """
    Sum up non-statutory deductions by type.

    Args:
        deductions: list of dicts with 'type' and 'amount' keys
    """
    advance = 0.0
    damage = 0.0
    other = 0.0

    for ded in deductions:
        ded_type = ded.get("type", "")
        amount = ded.get("amount", 0.0)
        if ded_type == "Advance":
            advance += amount
        elif ded_type in ("Damage", "Fine"):
            damage += amount
        else:
            other += amount

    return OtherDeductions(
        advance=round(advance, 2),
        damage=round(damage, 2),
        other=round(other, 2),
    )


def compute_employee_payroll(
    employee: EmployeeInfo,
    attendance: list[AttendanceRecord],
    components: WageComponents,
    deductions: list[dict],
    config: PayConfig,
    year: int,
    month: int,
) -> PayrollResult:
    """
    Top-level pure function: compute complete payroll for one employee.
    No DB access — takes all data as arguments, returns result.
    """
    days = count_attendance_days(
        attendance,
        employee.date_of_joining,
        employee.date_of_leaving,
        year,
        month,
        config.standard_hours_per_day,
    )

    wages = calculate_prorated_wages(components, days, config)
    statutory = calculate_statutory_deductions(wages, config, employee)
    other_ded = calculate_other_deductions(deductions)

    total_deductions = (
        statutory.pf
        + statutory.esi
        + statutory.pt
        + statutory.lwf
        + other_ded.advance
        + other_ded.damage
        + other_ded.other
    )
    net_salary = wages.gross - total_deductions

    return PayrollResult(
        employee_id=employee.id,
        year=year,
        month=month,
        days=days,
        wages=wages,
        statutory=statutory,
        other_deductions=other_ded,
        total_deductions=round(total_deductions, 2),
        net_salary=round(net_salary, 2),
        warnings=days.warnings,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# ORCHESTRATOR — DB-aware, calls the pure functions above
# ═══════════════════════════════════════════════════════════════════════════════


class PayrollEngine:
    """Calculates payroll for every on-roll employee for a given month.

    Migrated from the legacy app's `PayrollEngine`. The calculation path is
    untouched — only data access changed (async SQLAlchemy repositories →
    Django repositories). The engine still: clears the month, loads the pay
    config that was in force, converts ORM rows into the pure dataclasses,
    calls `compute_employee_payroll`, and persists the result.
    """

    def __init__(self, tenant_id=None) -> None:
        self.tenant_id = tenant_id if tenant_id is not None else context.current_tenant_id()
        self.employee_repo = EmployeeRepository()
        self.attendance_repo = AttendanceRepository()
        self.payroll_repo = PayrollRepository()
        self.salary_rule_repo = SalaryRuleRepository()
        self.deduction_repo = DeductionRepository()

    def _get_pay_config(self, year: int, month: int) -> PayConfig:
        """Load the pay rules that were in force for the given month."""
        target_date = date(year, month, 1)
        rule = (
            PayRulesConfig.objects.filter(effective_from__lte=target_date)
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=target_date))
            .order_by("-effective_from")
            .first()
        )

        if rule:
            return PayConfig(
                standard_days_per_month=rule.standard_days_per_month,
                standard_hours_per_day=rule.standard_hours_per_day,
                ot_multiplier=rule.ot_multiplier,
                pf_percent=rule.pf_employee_percent,
                pf_cap=rule.pf_cap,
                esi_percent=rule.esi_employee_percent,
                esi_wage_ceiling=rule.esi_wage_ceiling,
                esi_cap=rule.esi_cap,
            )

        # Fall back to defaults if no config exists
        logger.warning("No PayRulesConfig found - using hardcoded defaults")
        return PayConfig()

    @transaction.atomic
    def generate_payroll(self, year: int, month: int) -> list[Payroll]:
        """(Re)generate payroll for all on-roll employees for the month.

        Existing rows for the month are cleared first, so re-running replaces
        that month's figures rather than duplicating them.
        """
        logger.info("Generating payroll for %s-%02d", year, month)

        self.payroll_repo.delete_month(year, month)

        config = self._get_pay_config(year, month)

        employees = list(self.employee_repo.employees_for_month(year, month))
        logger.info("Found %d employees for %s-%02d", len(employees), year, month)

        results = []
        for emp in employees:
            payroll = self._calculate_and_persist(emp, year, month, config)
            if payroll:
                results.append(payroll)

        logger.info("Generated payroll for %d employees", len(results))
        return results

    def _expense_reimbursement(self, employee: Employee, year: int, month: int) -> float:
        """Approved expense claims dated in this month.

        Paid out with the salary as a non-taxable reimbursement: added after
        all deductions and never into gross, so the PF/ESI bases stay
        untouched.
        """
        total = ExpenseClaim.objects.filter(
            employee=employee,
            status=ClaimStatus.APPROVED,
            expense_date__year=year,
            expense_date__month=month,
        ).aggregate(total=Sum("amount"))["total"]
        return round(total or 0.0, 2)

    def _calculate_and_persist(
        self, employee: Employee, year: int, month: int, config: PayConfig
    ) -> Payroll | None:
        """Calculate payroll for a single employee and persist the result."""

        salary_rule = self.salary_rule_repo.effective_rule(employee.pk, year, month)
        if not salary_rule:
            logger.warning("No salary rule found for employee id=%s. Skipping.", employee.pk)
            return None

        att_records = self.attendance_repo.month_for_employee(employee.pk, year, month)
        deductions = self.deduction_repo.for_employee_month(employee.pk, year, month)
        expense_reimbursement = self._expense_reimbursement(employee, year, month)

        # -- Convert ORM -> pure types --
        emp_info = EmployeeInfo(
            id=employee.pk,
            employee_code=employee.employee_code,
            employee_name=employee.employee_name,
            date_of_joining=employee.date_of_joining,
            date_of_leaving=employee.date_of_leaving,
            pf_number=employee.pf_number,
            uan=employee.uan,
            esic_number=employee.esic_number,
            status=employee.status,
        )

        components = WageComponents(
            basic=salary_rule.basic,
            da=salary_rule.da,
            hra=salary_rule.hra,
            medical_allowance=salary_rule.medical_allowance,
            conveyance_allowance=salary_rule.conveyance_allowance,
            ot_rate_override=salary_rule.ot_rate,
        )

        att_data = [
            AttendanceRecord(
                day=r.day,
                status=r.status,
                in_time=r.in_time,
                out_time=r.out_time,
                worked_hours=r.worked_hours,
                ot_hours=r.ot_hours,
            )
            for r in att_records
        ]

        ded_data = [{"type": d.type, "amount": d.amount} for d in deductions]

        # -- Call pure function --
        result = compute_employee_payroll(
            emp_info, att_data, components, ded_data, config, year, month
        )

        # Log warnings
        for w in result.warnings:
            logger.warning("  employee id=%s: %s", employee.pk, w)

        # -- Persist --
        payroll = Payroll.objects.create(
            tenant_id=self.tenant_id or employee.tenant_id,
            employee=employee,
            year=year,
            month=month,
            present_days=int(result.days.present),
            leave_days=result.days.leave,
            holiday_days=result.days.holiday,
            holiday_working_days=result.days.holiday_working,
            week_off_days=result.days.week_off,
            total_paid_days=int(result.days.total_paid),
            absent_days=result.days.absent,
            ot_hours=result.days.ot_hours,
            basic_earned=result.wages.basic,
            da_earned=result.wages.da,
            hra_earned=result.wages.hra,
            medical_allowance=result.wages.medical,
            conveyance_allowance=result.wages.conveyance,
            nfh_wages=result.wages.nfh,
            ot_earned=result.wages.ot,
            leave_wages=result.wages.leave_wages,
            bonus_earned=0.0,
            arrear=0.0,
            gross_salary=result.wages.gross,
            pf_deduction=result.statutory.pf,
            esi_deduction=result.statutory.esi,
            professional_tax=result.statutory.pt,
            lwf=result.statutory.lwf,
            advance_deduction=result.other_deductions.advance,
            damage_deduction=result.other_deductions.damage,
            other_deductions=result.other_deductions.other,
            total_deductions=result.total_deductions,
            expense_reimbursement=expense_reimbursement,
            net_salary=round(result.net_salary + expense_reimbursement, 2),
        )

        logger.info(
            "  employee id=%s: %s present days, %s paid days",
            employee.pk,
            result.days.present,
            result.days.total_paid,
        )
        logger.debug(
            "  employee id=%s: gross=%.2f, net=%.2f",
            employee.pk,
            result.wages.gross,
            result.net_salary,
        )
        return payroll
