"""
Payroll Types — Pure Dataclasses for Engine I/O

These types define the interface for the payroll engine's pure functions.
Using dataclasses keeps the calculation layer independent of ORM models and
database concerns, making it independently testable.

Migrated from the legacy AutoSync HR app unchanged apart from the UUID typing
note below — see docs/specs/hr-migration.md.
"""

from dataclasses import dataclass, field
from datetime import date
from uuid import UUID


@dataclass
class EmployeeInfo:
    """Minimal employee info needed by the payroll engine."""

    # int | UUID: WWE OS models use UUID primary keys, while the engine's own
    # tests pass ints. The engine only carries the id, never computes on it.
    id: int | UUID
    employee_code: str
    employee_name: str
    date_of_joining: date
    date_of_leaving: date | None
    pf_number: str | None
    uan: str | None
    esic_number: str | None
    status: str


@dataclass
class WageComponents:
    """Per-employee declared monthly wage components from SalaryRule."""

    basic: float
    da: float
    hra: float
    medical_allowance: float
    conveyance_allowance: float
    ot_rate_override: float  # 0 = calculate from total salary

    @property
    def total_monthly(self) -> float:
        return self.basic + self.da + self.hra + self.medical_allowance + self.conveyance_allowance


@dataclass
class PayConfig:
    """Global statutory rates from PayRulesConfig."""

    standard_days_per_month: int = 26
    standard_hours_per_day: int = 8
    ot_multiplier: float = 2.0
    pf_percent: float = 12.0
    pf_cap: float = 1800.0
    esi_percent: float = 0.75
    esi_wage_ceiling: float = 21000.0
    esi_cap: float = 158.0


@dataclass
class AttendanceRecord:
    """Single day attendance record for the engine.

    worked_hours/ot_hours are the per-day values stored at save time.
    When present, the engine sums the stored daily OT (monthly OT =
    SUM(daily OT)); when None (legacy rows), it falls back to computing
    from the raw swipe times.
    """

    day: int
    status: str
    in_time: str | None  # "HH:MM" or None
    out_time: str | None  # "HH:MM" or None
    worked_hours: float | None = None
    ot_hours: float | None = None


@dataclass
class DayCounts:
    """Aggregated attendance day counts."""

    present: float  # float to support half-days (0.5)
    leave: int
    holiday: int
    holiday_working: int
    week_off: int
    absent: int
    half_days: int
    total_paid: float
    ot_hours: float
    warnings: list[str] = field(default_factory=list)


@dataclass
class WageBreakdown:
    """Computed wage breakdown after proration."""

    basic: float
    da: float
    hra: float
    medical: float
    conveyance: float
    nfh: float
    ot: float
    leave_wages: float
    gross: float


@dataclass
class StatutoryDeductions:
    """Computed statutory deductions."""

    pf: float
    esi: float
    pt: float
    lwf: float


@dataclass
class OtherDeductions:
    """Non-statutory deductions (advances, fines, damages)."""

    advance: float
    damage: float
    other: float

    @property
    def total(self) -> float:
        return self.advance + self.damage + self.other


@dataclass
class PayrollResult:
    """Complete payroll calculation result for one employee."""

    employee_id: int | UUID
    year: int
    month: int
    days: DayCounts
    wages: WageBreakdown
    statutory: StatutoryDeductions
    other_deductions: OtherDeductions
    total_deductions: float
    net_salary: float
    warnings: list[str] = field(default_factory=list)
