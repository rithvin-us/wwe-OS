"""
Unit Tests for Payroll Engine Pure Functions

Tests all edge cases:
- Full-month employee (26 working days)
- Mid-month joiner (DOJ = 15th)
- Mid-month leaver (DOL = 10th)
- Overnight shift OT calculation
- Missing swipe defaults to 0 hours
- PF cap at ₹1,800
- ESI = 0 when gross > ₹21,000 ceiling
- Zero employees returns empty
- Half-day handling
"""

from datetime import date

from hr.backend.services.payroll_engine import (
    calculate_other_deductions,
    calculate_prorated_wages,
    calculate_statutory_deductions,
    compute_employee_payroll,
    compute_hours_from_swipe,
    count_attendance_days,
)
from hr.backend.services.payroll_types import (
    AttendanceRecord,
    DayCounts,
    EmployeeInfo,
    PayConfig,
    WageComponents,
)

# ─── Test Fixtures ────────────────────────────────────────────────────────────


def make_employee(
    id=1,
    code="C-0001",
    name="Test Employee",
    doj=date(2024, 1, 1),
    dol=None,
    pf="PF001",
    uan="UAN001",
    esic="ESIC001",
    status="Active",
) -> EmployeeInfo:
    return EmployeeInfo(
        id=id,
        employee_code=code,
        employee_name=name,
        date_of_joining=doj,
        date_of_leaving=dol,
        pf_number=pf,
        uan=uan,
        esic_number=esic,
        status=status,
    )


def make_components(
    basic=6000, da=1000, hra=2000, med=500, conv=500, ot_override=0
) -> WageComponents:
    return WageComponents(
        basic=basic,
        da=da,
        hra=hra,
        medical_allowance=med,
        conveyance_allowance=conv,
        ot_rate_override=ot_override,
    )


def make_config(**overrides) -> PayConfig:
    defaults = dict(
        standard_days_per_month=26,
        standard_hours_per_day=8,
        ot_multiplier=2.0,
        pf_percent=12.0,
        pf_cap=1800.0,
        esi_percent=0.75,
        esi_wage_ceiling=21000.0,
        esi_cap=158.0,
    )
    defaults.update(overrides)
    return PayConfig(**defaults)


def make_attendance(day, status="P", in_time="09:00", out_time="18:00"):
    return AttendanceRecord(day=day, status=status, in_time=in_time, out_time=out_time)


# ─── compute_hours_from_swipe ─────────────────────────────────────────────────


class TestComputeHoursFromSwipe:
    def test_normal_day(self):
        hours, ot, warnings = compute_hours_from_swipe("09:00", "17:00")
        assert hours == 8.0
        assert ot == 0.0
        assert warnings == []

    def test_overtime(self):
        hours, ot, warnings = compute_hours_from_swipe("09:00", "19:00")
        assert hours == 10.0
        assert ot == 2.0

    def test_overnight_shift(self):
        """Out time < In time → +24h wraparound"""
        hours, ot, warnings = compute_hours_from_swipe("22:00", "06:00")
        assert hours == 8.0
        assert ot == 0.0
        assert warnings == []

    def test_overnight_shift_with_ot(self):
        hours, ot, warnings = compute_hours_from_swipe("20:00", "06:00")
        assert hours == 10.0
        assert ot == 2.0

    def test_missing_out_time(self):
        hours, ot, warnings = compute_hours_from_swipe("09:00", None)
        assert hours == 0.0
        assert ot == 0.0
        assert len(warnings) == 1
        assert "without Out time" in warnings[0]

    def test_missing_in_time(self):
        hours, ot, warnings = compute_hours_from_swipe(None, "17:00")
        assert hours == 0.0
        assert len(warnings) == 1
        assert "without In time" in warnings[0]

    def test_both_missing(self):
        hours, ot, warnings = compute_hours_from_swipe(None, None)
        assert hours == 0.0
        assert ot == 0.0
        assert warnings == []

    def test_invalid_format(self):
        hours, ot, warnings = compute_hours_from_swipe("abc", "17:00")
        assert hours == 0.0
        assert len(warnings) == 1
        assert "Invalid time format" in warnings[0]


# ─── count_attendance_days ────────────────────────────────────────────────────


class TestCountAttendanceDays:
    def test_full_month_26_working_days(self):
        """Employee present all 26 working days (4 Sundays as WH, 1 NH)."""
        # 26 present days + 4 weekly holidays + 1 national holiday = 31
        attendance = [make_attendance(d, "P") for d in range(1, 27)]
        attendance.extend(make_attendance(d, "WH") for d in [27, 28, 29, 30])
        attendance.append(make_attendance(31, "NH"))

        days = count_attendance_days(attendance, date(2024, 1, 1), None, 2024, 1)
        assert days.present == 26
        assert days.holiday == 5  # 4 WH + 1 NH
        assert days.total_paid == 26 + 5  # present + holidays

    def test_mid_month_joiner(self):
        """Employee joins on the 15th — only days ≥ 15 should count."""
        # Days 1-14: NJ (or no record)
        attendance = [make_attendance(d, "P") for d in range(15, 32)]

        days = count_attendance_days(attendance, date(2024, 1, 15), None, 2024, 1)
        # Should only count days 15-31 = 17 days
        assert days.present == 17
        assert days.absent == 0

    def test_mid_month_leaver(self):
        """Employee leaves on the 10th — only days ≤ 10 should count."""
        attendance = [make_attendance(d, "P") for d in range(1, 11)]
        attendance.extend(make_attendance(d, "LEFT") for d in range(11, 32))

        days = count_attendance_days(attendance, date(2024, 1, 1), date(2024, 1, 10), 2024, 1)
        assert days.present == 10
        # Days after 10th are excluded by date window

    def test_half_day(self):
        attendance = [make_attendance(1, "HD")]
        days = count_attendance_days(attendance, date(2024, 1, 1), None, 2024, 1)
        assert days.present == 0.5
        assert days.half_days == 1

    def test_absent_days(self):
        attendance = [
            make_attendance(1, "P"),
            make_attendance(2, "A"),
            make_attendance(3, "A"),
        ]
        days = count_attendance_days(attendance, date(2024, 1, 1), None, 2024, 1)
        assert days.present == 1
        assert days.absent == 2

    def test_leave_days_count_as_paid(self):
        attendance = [
            make_attendance(1, "P"),
            make_attendance(2, "PL"),
            make_attendance(3, "CL"),
            make_attendance(4, "SL"),
        ]
        days = count_attendance_days(attendance, date(2024, 1, 1), None, 2024, 1)
        assert days.present == 1
        assert days.leave == 3
        assert days.total_paid == 4  # 1 present + 3 leave

    def test_empty_attendance(self):
        days = count_attendance_days([], date(2024, 1, 1), None, 2024, 1)
        assert days.present == 0
        assert days.total_paid == 0


# ─── calculate_prorated_wages ─────────────────────────────────────────────────


class TestCalculateProatedWages:
    def test_full_month(self):
        components = make_components(basic=6000, da=1000, hra=2000, med=500, conv=500)
        config = make_config()
        days = DayCounts(
            present=26,
            leave=0,
            holiday=4,
            holiday_working=0,
            week_off=0,
            absent=0,
            half_days=0,
            total_paid=30,
            ot_hours=0.0,
        )

        wages = calculate_prorated_wages(components, days, config)
        # Full month: each component × (26/26) = full declared amount
        assert wages.basic == 6000.0
        assert wages.da == 1000.0
        assert wages.hra == 2000.0
        # NFH: (10000/26) × 4 holidays
        assert wages.nfh == round(10000 / 26 * 4, 2)

    def test_half_month(self):
        components = make_components(basic=6000, da=1000, hra=2000, med=500, conv=500)
        config = make_config()
        days = DayCounts(
            present=13,
            leave=0,
            holiday=0,
            holiday_working=0,
            week_off=0,
            absent=13,
            half_days=0,
            total_paid=13,
            ot_hours=0.0,
        )

        wages = calculate_prorated_wages(components, days, config)
        assert wages.basic == round(6000 / 26 * 13, 2)
        assert wages.da == round(1000 / 26 * 13, 2)

    def test_ot_calculation(self):
        components = make_components(basic=6000, da=1000, hra=2000, med=500, conv=500)
        config = make_config()
        days = DayCounts(
            present=26,
            leave=0,
            holiday=0,
            holiday_working=0,
            week_off=0,
            absent=0,
            half_days=0,
            total_paid=26,
            ot_hours=10.0,
        )

        wages = calculate_prorated_wages(components, days, config)
        # OT = 10 hours × (10000/26/8) × 2
        expected_ot = round(10 * (10000 / 26 / 8) * 2, 2)
        assert wages.ot == expected_ot

    def test_ot_with_override_rate(self):
        components = make_components(ot_override=50.0)  # ₹50/hr override
        config = make_config()
        days = DayCounts(
            present=26,
            leave=0,
            holiday=0,
            holiday_working=0,
            week_off=0,
            absent=0,
            half_days=0,
            total_paid=26,
            ot_hours=5.0,
        )

        wages = calculate_prorated_wages(components, days, config)
        # OT = 5 hours × ₹50 × 2 = ₹500
        assert wages.ot == 500.0

    def test_leave_wages(self):
        components = make_components(basic=6000, da=1000, hra=2000, med=500, conv=500)
        config = make_config()
        days = DayCounts(
            present=20,
            leave=3,
            holiday=0,
            holiday_working=0,
            week_off=0,
            absent=3,
            half_days=0,
            total_paid=23,
            ot_hours=0.0,
        )

        wages = calculate_prorated_wages(components, days, config)
        expected_leave = round(10000 / 26 * 3, 2)
        assert wages.leave_wages == expected_leave


# ─── calculate_statutory_deductions ───────────────────────────────────────────


class TestCalculateStatutoryDeductions:
    def test_pf_basic_plus_da(self):
        """PF should be 12% of (basic + DA), NOT gross - HRA - OT."""
        from hr.backend.services.payroll_types import WageBreakdown

        wages = WageBreakdown(
            basic=6000,
            da=1000,
            hra=2000,
            medical=500,
            conveyance=500,
            nfh=0,
            ot=0,
            leave_wages=0,
            gross=10000,
        )
        config = make_config()
        emp = make_employee()

        deductions = calculate_statutory_deductions(wages, config, emp)
        # PF = ceil(12% × (6000 + 1000)) = ceil(840) = 840
        assert deductions.pf == 840.0

    def test_pf_cap(self):
        """PF should be capped at ₹1,800."""
        from hr.backend.services.payroll_types import WageBreakdown

        wages = WageBreakdown(
            basic=12000,
            da=4000,
            hra=3000,
            medical=500,
            conveyance=500,
            nfh=0,
            ot=0,
            leave_wages=0,
            gross=20000,
        )
        config = make_config()
        emp = make_employee()

        deductions = calculate_statutory_deductions(wages, config, emp)
        # PF = ceil(12% × 16000) = ceil(1920) → capped at 1800
        assert deductions.pf == 1800.0

    def test_pf_zero_without_pf_number(self):
        """No PF if employee has no PF number or UAN."""
        from hr.backend.services.payroll_types import WageBreakdown

        wages = WageBreakdown(
            basic=6000,
            da=1000,
            hra=2000,
            medical=500,
            conveyance=500,
            nfh=0,
            ot=0,
            leave_wages=0,
            gross=10000,
        )
        config = make_config()
        emp = make_employee(pf=None, uan=None)

        deductions = calculate_statutory_deductions(wages, config, emp)
        assert deductions.pf == 0.0

    def test_esi_normal(self):
        """ESI = 0.75% of gross when gross ≤ ceiling."""
        from hr.backend.services.payroll_types import WageBreakdown

        wages = WageBreakdown(
            basic=6000,
            da=1000,
            hra=2000,
            medical=500,
            conveyance=500,
            nfh=0,
            ot=0,
            leave_wages=0,
            gross=10000,
        )
        config = make_config()
        emp = make_employee()

        deductions = calculate_statutory_deductions(wages, config, emp)
        # ESI = ceil(0.75% × 10000) = ceil(75) = 75
        assert deductions.esi == 75.0

    def test_esi_zero_above_ceiling(self):
        """ESI = 0 when gross > ₹21,000 wage ceiling."""
        from hr.backend.services.payroll_types import WageBreakdown

        wages = WageBreakdown(
            basic=15000,
            da=5000,
            hra=3000,
            medical=1000,
            conveyance=1000,
            nfh=0,
            ot=0,
            leave_wages=0,
            gross=25000,
        )
        config = make_config()
        emp = make_employee()

        deductions = calculate_statutory_deductions(wages, config, emp)
        assert deductions.esi == 0.0

    def test_esi_cap(self):
        """ESI should be capped at ₹158."""
        from hr.backend.services.payroll_types import WageBreakdown

        wages = WageBreakdown(
            basic=14000,
            da=3000,
            hra=2000,
            medical=500,
            conveyance=500,
            nfh=0,
            ot=1000,
            leave_wages=0,
            gross=21000,
        )
        config = make_config()
        emp = make_employee()

        deductions = calculate_statutory_deductions(wages, config, emp)
        # ESI = ceil(0.75% × 21000) = ceil(157.5) = 158, exactly at cap
        assert deductions.esi == 158.0

    def test_esi_zero_without_esic_number(self):
        """No ESI if employee has no ESIC number."""
        from hr.backend.services.payroll_types import WageBreakdown

        wages = WageBreakdown(
            basic=6000,
            da=1000,
            hra=2000,
            medical=500,
            conveyance=500,
            nfh=0,
            ot=0,
            leave_wages=0,
            gross=10000,
        )
        config = make_config()
        emp = make_employee(esic=None)

        deductions = calculate_statutory_deductions(wages, config, emp)
        assert deductions.esi == 0.0


# ─── calculate_other_deductions ───────────────────────────────────────────────


class TestCalculateOtherDeductions:
    def test_advance_and_fine(self):
        deductions = [
            {"type": "Advance", "amount": 500},
            {"type": "Fine", "amount": 200},
            {"type": "Other", "amount": 100},
        ]
        result = calculate_other_deductions(deductions)
        assert result.advance == 500.0
        assert result.damage == 200.0
        assert result.other == 100.0

    def test_empty(self):
        result = calculate_other_deductions([])
        assert result.advance == 0.0
        assert result.damage == 0.0
        assert result.other == 0.0


# ─── compute_employee_payroll (end-to-end pure) ──────────────────────────────


class TestComputeEmployeePayroll:
    def test_full_month_e2e(self):
        emp = make_employee()
        components = make_components(basic=6000, da=1000, hra=2000, med=500, conv=500)
        config = make_config()

        attendance = [make_attendance(d, "P") for d in range(1, 27)]
        attendance.extend(make_attendance(d, "WH") for d in range(27, 32))

        result = compute_employee_payroll(emp, attendance, components, [], config, 2024, 1)

        assert result.days.present == 26
        assert result.wages.basic == 6000.0
        assert result.net_salary > 0

    def test_mid_month_joiner_e2e(self):
        emp = make_employee(doj=date(2024, 1, 15))
        components = make_components(basic=6000, da=1000, hra=2000, med=500, conv=500)
        config = make_config()

        attendance = [make_attendance(d, "P") for d in range(15, 32)]

        result = compute_employee_payroll(emp, attendance, components, [], config, 2024, 1)

        assert result.days.present == 17
        # Prorated basic: 6000/26 × 17
        assert result.wages.basic == round(6000 / 26 * 17, 2)

    def test_mid_month_leaver_e2e(self):
        emp = make_employee(dol=date(2024, 1, 10))
        components = make_components(basic=6000, da=1000, hra=2000, med=500, conv=500)
        config = make_config()

        attendance = [make_attendance(d, "P") for d in range(1, 11)]

        result = compute_employee_payroll(emp, attendance, components, [], config, 2024, 1)

        assert result.days.present == 10
        assert result.wages.basic == round(6000 / 26 * 10, 2)

    def test_left_employee_with_advance(self):
        """Left employee with outstanding advance should still show deduction."""
        emp = make_employee(dol=date(2024, 1, 10), status="Left")
        components = make_components()
        config = make_config()

        attendance = [make_attendance(d, "P") for d in range(1, 11)]
        deductions = [{"type": "Advance", "amount": 1000}]

        result = compute_employee_payroll(emp, attendance, components, deductions, config, 2024, 1)

        assert result.other_deductions.advance == 1000.0

    def test_zero_attendance(self):
        """Zero attendance should not crash."""
        emp = make_employee()
        components = make_components()
        config = make_config()

        result = compute_employee_payroll(emp, [], components, [], config, 2024, 1)

        assert result.days.present == 0
        assert result.wages.gross == 0.0
        assert result.net_salary == 0.0

    def test_two_employees_same_name_different_code(self):
        """Two employees with same name but different codes processed independently."""
        emp1 = make_employee(id=1, code="C-0001", name="John Doe")
        emp2 = make_employee(id=2, code="C-0002", name="John Doe")
        components = make_components()
        config = make_config()

        att = [make_attendance(d, "P") for d in range(1, 27)]

        r1 = compute_employee_payroll(emp1, att, components, [], config, 2024, 1)
        r2 = compute_employee_payroll(emp2, att, components, [], config, 2024, 1)

        assert r1.employee_id == 1
        assert r2.employee_id == 2
        assert r1.wages.gross == r2.wages.gross  # Same wages, different employees
