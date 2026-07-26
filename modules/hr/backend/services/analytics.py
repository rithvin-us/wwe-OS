"""Workforce analytics — read-only aggregations over existing tables.

Migrated from the legacy app's analytics service. Every metric definition,
threshold and tally is unchanged; only the data fetching moved from async
SQLAlchemy to Django, and the period-lock lookup now asks `platform/periods`
instead of a local table.

Everything here is derived on demand from employees / attendance / payroll /
periods / punch logs. No new tables, no writes. The dataset is a single site
(hundreds of employees × ~30 days), so rows are fetched for the month and
aggregated in Python — simpler and easier to audit than hand-tuned SQL, and well
within memory at this scale.

Metric definitions (kept explicit so dashboards and reports agree):
  working_units = present_full + half*0.5 + absent + leave   (days a person was
                  scheduled to work; holidays/week-offs/NJ/LEFT are excluded)
  present_units = present_full + half*0.5
  attendance_pct = present_units / working_units * 100
"""

from __future__ import annotations

from calendar import monthrange
from collections.abc import Iterable
from datetime import date

from django.db.models import Q
from periods.services import PeriodService
from shared import context

from hr.backend.models import (
    Attendance,
    Employee,
    EmployeeStatus,
    Payroll,
    PunchLog,
)
from hr.backend.services.shift_rules import SHIFT_DEFINITIONS, normalize_shift

# ── status groups ─────────────────────────────────────────────────────────────
PRESENT = "P"
HALF_DAY = "HD"
ABSENT = "A"
LEAVE = {"L", "PL", "CL", "SL"}
HOLIDAY_OFF = {"NH", "WH", "WO", "CO"}
NEUTRAL = {"NJ", "LEFT"}  # excluded from every denominator

# ── anomaly thresholds ────────────────────────────────────────────────────────
MONTHLY_OT_ALERT_HOURS = 50.0  # employee monthly OT above this -> excessive
DAILY_OT_ALERT_HOURS = 4.0  # single day OT above this -> excessive
AUTO_APPROVED = "auto_approved"
FLAGGED = "flagged"

_MONTH_ABBR = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]


def _pct(numer: float, denom: float) -> float:
    return round(numer / denom * 100, 1) if denom else 0.0


def _is_active(emp: Employee) -> bool:
    return emp.status != EmployeeStatus.LEFT and emp.date_of_leaving is None


def _accumulate(rows: Iterable[Attendance]) -> dict:
    """Tally attendance-status units + OT over a set of rows."""
    acc = {
        "present_full": 0,
        "half": 0,
        "absent": 0,
        "leave": 0,
        "holiday_off": 0,
        "ot_hours": 0.0,
    }
    for r in rows:
        s = (r.status or "").upper()
        if s == PRESENT:
            acc["present_full"] += 1
        elif s == HALF_DAY:
            acc["half"] += 1
        elif s == ABSENT:
            acc["absent"] += 1
        elif s in LEAVE:
            acc["leave"] += 1
        elif s in HOLIDAY_OFF:
            acc["holiday_off"] += 1
        acc["ot_hours"] += r.ot_hours or 0.0
    acc["present_units"] = acc["present_full"] + acc["half"] * 0.5
    acc["working_units"] = acc["present_units"] + acc["absent"] + acc["leave"]
    return acc


def _prev_months(year: int, month: int, count: int) -> list[tuple[int, int]]:
    out = []
    y, m = year, month
    for _ in range(count):
        out.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(out))


def _month_attendance(year: int, month: int) -> list[Attendance]:
    return list(Attendance.objects.filter(year=year, month=month).select_related("employee"))


def _all_employees() -> list[Employee]:
    return list(Employee.objects.all())


def workforce_summary(year: int, month: int) -> dict:
    employees = _all_employees()
    records = _month_attendance(year, month)

    active = [e for e in employees if _is_active(e)]
    left = [e for e in employees if not _is_active(e)]
    new_joiners = [
        e
        for e in employees
        if e.date_of_joining and e.date_of_joining.year == year and e.date_of_joining.month == month
    ]
    leavers = [
        e
        for e in employees
        if e.date_of_leaving and e.date_of_leaving.year == year and e.date_of_leaving.month == month
    ]

    total = _accumulate(records)

    # Departments
    dept_rows: dict[str, list[Attendance]] = {}
    for r in records:
        dept = (r.employee.department if r.employee else None) or "Unassigned"
        dept_rows.setdefault(dept, []).append(r)
    dept_head: dict[str, int] = {}
    for e in active:
        key = e.department or "Unassigned"
        dept_head[key] = dept_head.get(key, 0) + 1
    departments = []
    for dept in sorted(set(list(dept_rows) + list(dept_head))):
        a = _accumulate(dept_rows.get(dept, []))
        departments.append(
            {
                "department": dept,
                "headcount": dept_head.get(dept, 0),
                "present_units": a["present_units"],
                "working_units": a["working_units"],
                "attendance_pct": _pct(a["present_units"], a["working_units"]),
                "ot_hours": round(a["ot_hours"], 1),
            }
        )

    # Shift utilization (present days only)
    shift_counts = {k: 0 for k in SHIFT_DEFINITIONS}
    present_total = 0
    for r in records:
        if (r.status or "").upper() in (PRESENT, HALF_DAY):
            sh = normalize_shift(r.shift)
            shift_counts[sh] = shift_counts.get(sh, 0) + 1
            present_total += 1
    shifts = [
        {
            "shift": sh,
            "name": SHIFT_DEFINITIONS[sh].name,
            "present_days": shift_counts.get(sh, 0),
            "pct": _pct(shift_counts.get(sh, 0), present_total),
        }
        for sh in SHIFT_DEFINITIONS
    ]

    # Compliance (active employees)
    def _missing(val) -> bool:
        return not (val and str(val).strip())

    missing_pf = sum(1 for e in active if _missing(e.pf_number))
    missing_esic = sum(1 for e in active if _missing(e.esic_number))
    missing_uan = sum(1 for e in active if _missing(e.uan))
    not_enrolled = sum(1 for e in active if _missing(e.face_embedding))
    compliant = sum(
        1
        for e in active
        if not _missing(e.pf_number) and not _missing(e.esic_number) and not _missing(e.uan)
    )

    # Payroll readiness
    payroll_generated = Payroll.objects.filter(year=year, month=month).count()
    payroll_eligible = len(active)

    period_locked = PeriodService().is_locked(
        tenant=context.current_tenant(), year=year, month=month
    )

    anomalies = detect_anomalies(year, month)

    return {
        "year": year,
        "month": month,
        "total_employees": len(employees),
        "active_employees": len(active),
        "left_employees": len(left),
        "new_joiners": len(new_joiners),
        "leavers_this_month": len(leavers),
        "present_units": round(total["present_units"], 1),
        "absent_days": total["absent"],
        "leave_days": total["leave"],
        "holiday_off_days": total["holiday_off"],
        "working_units": round(total["working_units"], 1),
        "attendance_pct": _pct(total["present_units"], total["working_units"]),
        "leave_pct": _pct(total["leave"], total["working_units"]),
        "absent_pct": _pct(total["absent"], total["working_units"]),
        "total_ot_hours": round(total["ot_hours"], 1),
        "avg_ot_per_active": round(total["ot_hours"] / len(active), 1) if active else 0.0,
        "payroll_generated": payroll_generated,
        "payroll_eligible": payroll_eligible,
        "payroll_readiness_pct": _pct(payroll_generated, payroll_eligible),
        "period_locked": period_locked,
        "departments": departments,
        "shifts": shifts,
        "compliance": {
            "active": len(active),
            "missing_pf": missing_pf,
            "missing_esic": missing_esic,
            "missing_uan": missing_uan,
            "not_face_enrolled": not_enrolled,
            "compliant_pct": _pct(compliant, len(active)),
        },
        "anomaly_count": anomalies["total"],
    }


def attendance_trends(year: int, month: int, months: int) -> dict:
    months = max(1, min(months, 24))
    span = _prev_months(year, month, months)
    y0, m0 = span[0]
    # One query for the whole window (bounded both ends), bucketed by
    # (year, month) in Python.
    rows = list(
        Attendance.objects.filter(
            Q(year__gt=y0) | Q(year=y0, month__gte=m0),
        ).filter(
            Q(year__lt=year) | Q(year=year, month__lte=month),
        )
    )
    want = set(span)
    buckets: dict[tuple[int, int], list[Attendance]] = {ym: [] for ym in span}
    for r in rows:
        if (r.year, r.month) in want:
            buckets[(r.year, r.month)].append(r)

    employees = _all_employees()

    points = []
    for y, m in span:
        a = _accumulate(buckets[(y, m)])
        # Headcount active AS OF month end: joined on/before the last day and
        # not yet left before it (a mid-month leaver is NOT counted at end).
        end = date(y, m, monthrange(y, m)[1])
        active_n = sum(
            1
            for e in employees
            if e.date_of_joining
            and e.date_of_joining <= end
            and (e.date_of_leaving is None or e.date_of_leaving >= end)
        )
        points.append(
            {
                "year": y,
                "month": m,
                "label": f"{_MONTH_ABBR[m]} {y}",
                "attendance_pct": _pct(a["present_units"], a["working_units"]),
                "present_units": round(a["present_units"], 1),
                "working_units": round(a["working_units"], 1),
                "total_ot_hours": round(a["ot_hours"], 1),
                "active_employees": active_n,
            }
        )
    return {"points": points}


def detect_anomalies(year: int, month: int) -> dict:
    records = _month_attendance(year, month)
    employees = _all_employees()

    punches = list(
        PunchLog.objects.filter(
            captured_at__gte=date(year, month, 1),
            captured_at__lt=date(year + (month == 12), (month % 12) + 1, 1),
        )
    )

    anomalies: list[dict] = []

    def add(atype, severity, detail, emp=None, day=None):
        anomalies.append(
            {
                "type": atype,
                "severity": severity,
                "detail": detail,
                "employee_id": emp.pk if emp else None,
                "employee_code": emp.employee_code if emp else None,
                "employee_name": emp.employee_name if emp else None,
                "day": day,
            }
        )

    # Per-employee monthly OT + per-day scan
    emp_by_id = {e.pk: e for e in employees}
    ot_by_emp: dict = {}
    emp_has_rows: set = set()
    for r in records:
        emp = r.employee or emp_by_id.get(r.employee_id)
        emp_has_rows.add(r.employee_id)
        ot_by_emp[r.employee_id] = ot_by_emp.get(r.employee_id, 0.0) + (r.ot_hours or 0.0)
        s = (r.status or "").upper()
        # Missing punch: present but incomplete swipe pair
        if s == PRESENT:
            if r.in_time and not r.out_time:
                add(
                    "MISSING_PUNCH",
                    "medium",
                    f"Day {r.day}: punched in ({r.in_time}) but never out",
                    emp,
                    r.day,
                )
            elif r.out_time and not r.in_time:
                add(
                    "MISSING_PUNCH",
                    "medium",
                    f"Day {r.day}: out-punch with no in-punch",
                    emp,
                    r.day,
                )
        # Excessive daily OT
        if (r.ot_hours or 0.0) > DAILY_OT_ALERT_HOURS:
            add(
                "EXCESSIVE_OT",
                "medium",
                f"Day {r.day}: {r.ot_hours:.1f}h OT in one day",
                emp,
                r.day,
            )

    for emp_id, ot in ot_by_emp.items():
        if ot > MONTHLY_OT_ALERT_HOURS:
            add(
                "EXCESSIVE_OT",
                "high",
                f"{ot:.1f}h total OT this month (>{MONTHLY_OT_ALERT_HOURS:.0f}h)",
                emp_by_id.get(emp_id),
            )

    # Missing attendance: active employee joined by month-end but no rows at all
    end = date(year, month, monthrange(year, month)[1])
    for e in employees:
        if not _is_active(e):
            continue
        if e.date_of_joining and e.date_of_joining > end:
            continue
        if e.pk not in emp_has_rows:
            add("MISSING_ATTENDANCE", "high", "No attendance recorded for this month", e)

    # Punch-log driven: flagged captures, double punches, present-vs-absent conflicts
    by_emp_day: dict[tuple, list[PunchLog]] = {}
    for p in punches:
        if p.decision == FLAGGED:
            emp = emp_by_id.get(p.employee_id) if p.employee_id else None
            add(
                "SUSPICIOUS_ATTENDANCE",
                "high",
                f"Flagged check-in at {p.captured_at.strftime('%d %b %H:%M')}"
                + (
                    f" (face score {p.face_match_score:.2f})"
                    if p.face_match_score is not None
                    else ""
                ),
                emp,
                p.captured_at.day,
            )
        if p.employee_id and p.decision == AUTO_APPROVED:
            by_emp_day.setdefault((p.employee_id, p.captured_at.day), []).append(p)

    att_index = {(r.employee_id, r.day): r for r in records}
    for (emp_id, day), plist in by_emp_day.items():
        emp = emp_by_id.get(emp_id)
        if len(plist) > 2:
            add(
                "DOUBLE_PUNCH",
                "low",
                f"Day {day}: {len(plist)} approved punches (expected in + out)",
                emp,
                day,
            )
        att = att_index.get((emp_id, day))
        if att and (att.status or "").upper() in ({ABSENT} | LEAVE):
            add(
                "ATTENDANCE_CONFLICT",
                "medium",
                f"Day {day}: approved face check-in but marked '{att.status}'",
                emp,
                day,
            )

    by_type: dict[str, int] = {}
    for a in anomalies:
        by_type[a["type"]] = by_type.get(a["type"], 0) + 1

    severity_rank = {"high": 0, "medium": 1, "low": 2}
    anomalies.sort(key=lambda a: (severity_rank.get(a["severity"], 9), a["type"], a["day"] or 0))

    return {
        "year": year,
        "month": month,
        "total": len(anomalies),
        "by_type": by_type,
        "anomalies": anomalies,
    }
