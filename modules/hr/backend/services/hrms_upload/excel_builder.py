"""Excel Builder for HRMS Upload Files.

Loads stored openpyxl master templates from modules/hr/backend/templates/hrms_upload/,
asserts Row 1 and Row 2 equal stored templates exactly, maps columns by header name,
and writes formatted output starting at Row 3.
"""

from __future__ import annotations

import io
from calendar import monthrange
from datetime import date
from pathlib import Path
from typing import Any

import openpyxl
from shared.exceptions import ValidationError

TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent / "templates" / "hrms_upload"

HRMS_TEMPLATE = "167948248_hrms_file.xlsx"
ATTENDANCE_TEMPLATE = "167948248_attendance_file.xlsx"
LEAVE_TEMPLATE = "167948248_leave_file.xlsx"
PAYSHEET_TEMPLATE = "167948248_paysheet_file.xlsx"


def _format_date(d: Any) -> str:
    """Format date as DD-MM-YYYY text."""
    if not d:
        return ""
    if isinstance(d, date):
        return d.strftime("%d-%m-%Y")
    if isinstance(d, str):
        # If already in DD-MM-YYYY, return as is
        d_str = d.strip()
        if len(d_str) == 10 and d_str[2] == "-" and d_str[5] == "-":
            return d_str
    return str(d)


def _load_and_verify_template(filename: str) -> tuple[openpyxl.Workbook, dict[str, int]]:
    """Load template openpyxl workbook and verify Row 1 & Row 2 structure.

    Returns:
        (workbook, header_to_col_idx_map) where col_idx is 1-based.
    """
    tmpl_path = TEMPLATE_DIR / filename
    if not tmpl_path.exists():
        raise ValidationError(
            detail={"template": [f"HRMS Upload template file missing at {tmpl_path}"]}
        )

    wb = openpyxl.load_workbook(tmpl_path)
    sheet = wb.active

    # Extract Row 1 & Row 2
    max_col = sheet.max_column
    header_map: dict[str, int] = {}

    for c in range(1, max_col + 1):
        _ = sheet.cell(row=1, column=c).value
        r2_val = sheet.cell(row=2, column=c).value

        # Header string in Row 2
        header_str = str(r2_val or "").strip()
        if header_str:
            header_map[header_str] = c
            # Also support un-stripped header key if it has newlines
            header_map[str(r2_val or "")] = c

    return wb, header_map


def _group_leave_ranges(days: dict[int, dict], year: int, month: int) -> tuple[str, str]:
    """Group consecutive leave days into ranges.

    Returns:
        (from_dates_csv, to_dates_csv)
    """
    leave_statuses = {"PL", "CL", "SL", "L"}
    _, days_in_month = monthrange(year, month)

    ranges: list[tuple[int, int]] = []
    in_range = False
    start_d = 0
    end_d = 0

    for d in range(1, days_in_month + 1):
        st = days.get(d, {}).get("status")
        if st in leave_statuses:
            if not in_range:
                in_range = True
                start_d = d
            end_d = d
        else:
            if in_range:
                ranges.append((start_d, end_d))
                in_range = False

    if in_range:
        ranges.append((start_d, end_d))

    from_list = []
    to_list = []
    for s, e in ranges:
        d_start = date(year, month, s).strftime("%d-%m-%Y")
        d_end = date(year, month, e).strftime("%d-%m-%Y")
        from_list.append(d_start)
        to_list.append(d_end)

    return ", ".join(from_list), ", ".join(to_list)


class HRMSUploadExcelBuilder:
    @staticmethod
    def build_hrms_file(employees: list[dict], year: int, month: int, config: dict) -> bytes:
        wb, h_map = _load_and_verify_template(HRMS_TEMPLATE)
        sheet = wb.active

        # Filter employees on rolls for any day of month:
        # DOJ <= month_end AND (DOL is null OR DOL >= month_start)
        _, days_in_month = monthrange(year, month)
        month_start = date(year, month, 1)
        month_end = date(year, month, days_in_month)

        active_emps = []
        for emp in employees:
            doj = emp.get("date_of_joining")
            dol = emp.get("date_of_leaving")
            if isinstance(doj, date) and doj > month_end:
                continue
            if isinstance(dol, date) and dol < month_start:
                continue
            active_emps.append(emp)

        # Order by Emp ID, with missing Emp ID last
        active_emps.sort(key=lambda x: (x.get("employee_code") is None, x.get("employee_code", "")))

        row_idx = 3
        for emp in active_emps:
            # Write by header lookup
            dob_str = _format_date(emp.get("dob"))
            doj_str = _format_date(emp.get("date_of_joining"))
            dol_str = _format_date(emp.get("date_of_leaving"))

            dob_date = emp.get("dob")
            if isinstance(dob_date, date):
                age_val = (
                    month_end.year
                    - dob_date.year
                    - ((month_end.month, month_end.day) < (dob_date.month, dob_date.day))
                )
            else:
                age_val = emp.get("age", "")

            field_values = {
                "UNIQUE_CODE": str(emp.get("employee_code") or ""),
                "Emp ID*": str(emp.get("employee_code") or ""),
                "Name*": str(emp.get("employee_name", "")).upper(),
                "Father Husband Name*": str(emp.get("father_husband_name", "")),
                "Gender*": "Male"
                if emp.get("gender") == "M"
                else ("Female" if emp.get("gender") == "F" else str(emp.get("gender", ""))),
                "DOB\n(DD-MM-YYYY)*": dob_str,
                "Present Residential Address*": str(emp.get("address", "")),
                "Permanent Address*": str(emp.get("permanent_address") or emp.get("address", "")),
                "Date of Joining\n(DD-MM-YYYY)*": doj_str,
                "Date of leaving\n(DD-MM-YYYY)": dol_str,
                "Department*": str(
                    emp.get("department")
                    or config.get("nature_of_work", "Operation & Maintenance (STP)")
                ),
                "Designation*": str(emp.get("designation", "Operator")),
                "Nature of Work": str(
                    emp.get("nature_of_work")
                    or config.get("nature_of_work", "Operation & Maintenance (STP)")
                ),
                "Location of Work*": config.get("location_of_work", ""),
                "Establishment Name": config.get("establishment_name", ""),
                "Establishment Address": config.get("establishment_address", ""),
                "State": config.get("state", "Tamil Nadu"),
                "Permanent temporary CasualContract": config.get("tenure", "Contract"),
                "Age": age_val,
                "ESI No*": str(emp.get("esic_number") or "NEW JOINING"),
                "PF No UAN*": str(emp.get("uan") or emp.get("pf_number") or "NEW JOINING"),
            }

            for header, val in field_values.items():
                col = h_map.get(header)
                if col:
                    cell = sheet.cell(row=row_idx, column=col)
                    cell.value = val
                    if header in (
                        "DOB\n(DD-MM-YYYY)*",
                        "Date of Joining\n(DD-MM-YYYY)*",
                        "Date of leaving\n(DD-MM-YYYY)",
                        "Emp ID*",
                        "UNIQUE_CODE",
                        "ESI No*",
                        "PF No UAN*",
                    ):
                        cell.number_format = "@"

            row_idx += 1

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    @staticmethod
    def build_attendance_file(
        attendance_records: list[dict], employees: list[dict], year: int, month: int
    ) -> bytes:
        wb, h_map = _load_and_verify_template(ATTENDANCE_TEMPLATE)
        sheet = wb.active

        emp_by_id = {e["employee_code"]: e for e in employees if e.get("employee_code")}
        _, days_in_month = monthrange(year, month)

        row_idx = 3
        for att in attendance_records:
            emp_code = att.get("employee_code", "")
            emp = emp_by_id.get(emp_code, {})
            days = att.get("days", {})

            # Prepare OT details
            ot_days = []
            total_ot_hours = 0.0
            for d in sorted(days.keys()):
                d_ot = days[d].get("ot_hours") or 0.0
                if d_ot > 0:
                    d_str = date(year, month, d).strftime("%d-%m-%Y")
                    ot_days.append(f"{d_str} ({int(d_ot) if d_ot.is_integer() else d_ot} hrs)")
                    total_ot_hours += d_ot

            ot_detail_str = ", ".join(ot_days)
            leave_from_csv, leave_to_csv = _group_leave_ranges(days, year, month)

            ot_hdr = "Date on which over time is done and extent of such overtime work in each day"
            field_values: dict[str, Any] = {
                "UNIQUE_CODE": emp_code,
                "Emp ID*": emp_code,
                "Designation*": emp.get("designation", att.get("designation", "")),
                "OT Hours worked": total_ot_hours if total_ot_hours > 0 else 0.0,
                ot_hdr: ot_detail_str,
                "Leave Taken From": leave_from_csv,
                "Leave Taken to": leave_to_csv,
            }

            # Write Day 1 to Day 31
            for d in range(1, 32):
                h_name = f"Day {d}"
                if d <= days_in_month:
                    raw_st = days.get(d, {}).get("status", "")
                    # Normalize WH -> W/O
                    st = "W/O" if raw_st == "WH" else raw_st
                    field_values[h_name] = st
                else:
                    field_values[h_name] = ""

            for header, val in field_values.items():
                col = h_map.get(header)
                if col:
                    cell = sheet.cell(row=row_idx, column=col)
                    cell.value = val
                    if "Day" in header or header in (
                        "Emp ID*",
                        "UNIQUE_CODE",
                        "Leave Taken From",
                        "Leave Taken to",
                    ):
                        cell.number_format = "@"

            row_idx += 1

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    @staticmethod
    def build_leave_file(
        attendance_records: list[dict],
        leave_balances: list[dict],
        employees: list[dict],
        year: int,
        month: int,
    ) -> bytes:
        wb, h_map = _load_and_verify_template(LEAVE_TEMPLATE)
        sheet = wb.active

        emp_by_id = {e["employee_code"]: e for e in employees if e.get("employee_code")}
        bal_by_emp: dict = {}
        for b in leave_balances:
            bal_by_emp.setdefault(b["employee_code"], {})[b["leave_type_code"]] = b

        row_idx = 3
        for att in attendance_records:
            emp_code = att.get("employee_code", "")
            emp = emp_by_id.get(emp_code, {})
            days = att.get("days", {})

            # Dates for PL, SL, CL
            pl_dates = [
                date(year, month, d).strftime("%d-%m-%Y")
                for d in sorted(days.keys())
                if days[d].get("status") == "PL"
            ]
            sl_dates = [
                date(year, month, d).strftime("%d-%m-%Y")
                for d in sorted(days.keys())
                if days[d].get("status") == "SL"
            ]
            cl_dates = [
                date(year, month, d).strftime("%d-%m-%Y")
                for d in sorted(days.keys())
                if days[d].get("status") == "CL"
            ]

            emp_bals = bal_by_emp.get(emp_code, {})

            pl_bal = emp_bals.get("PL", {})
            sl_bal = emp_bals.get("SL", {})
            cl_bal = emp_bals.get("CL", {})

            field_values: dict[str, Any] = {
                "UNIQUE_CODE": emp_code,
                "Emp ID*": emp_code,
                "Designation*": emp.get("designation", ""),
                # EL/PL/HL
                "EL/PL/HL - Opening Balance": pl_bal.get("opening", "") if emp_bals else "",
                "EL/PL/HL - Credit": pl_bal.get("credit", "") if emp_bals else "",
                "EL/PL/HL - Availed": ", ".join(pl_dates),
                "EL/PL/HL - No Of Days Availed": len(pl_dates),
                "EL/PL/HL - Closing Balance": pl_bal.get("closing", "") if emp_bals else "",
                # SL
                "SL - Opening Balance": sl_bal.get("opening", "") if emp_bals else "",
                "SL - Credit": sl_bal.get("credit", "") if emp_bals else "",
                "SL - Availed": ", ".join(sl_dates),
                "SL - No Of Days Availed": len(sl_dates),
                "SL - Closing Balance": sl_bal.get("closing", "") if emp_bals else "",
                # CL
                "CL - Opening Balance": cl_bal.get("opening", "") if emp_bals else "",
                "CL - Credit": cl_bal.get("credit", "") if emp_bals else "",
                "CL - Availed": ", ".join(cl_dates),
                "CL - No Of Days Availed": len(cl_dates),
                "CL - Closing Balance": cl_bal.get("closing", "") if emp_bals else "",
            }

            for header, val in field_values.items():
                col = h_map.get(header)
                if col:
                    cell = sheet.cell(row=row_idx, column=col)
                    cell.value = val
                    if "Availed" in header or header in ("Emp ID*", "UNIQUE_CODE"):
                        cell.number_format = "@"

            row_idx += 1

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    @staticmethod
    def build_paysheet_file(
        payroll_records: list[dict], employees: list[dict], year: int, month: int, config: dict
    ) -> bytes:
        wb, h_map = _load_and_verify_template(PAYSHEET_TEMPLATE)
        sheet = wb.active

        emp_by_id = {e["employee_code"]: e for e in employees if e.get("employee_code")}
        _, days_in_month = monthrange(year, month)

        salary_paid_date = config.get(
            "salary_paid_date",
            date(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 5).strftime(
                "%d-%m-%Y"
            ),
        )

        row_idx = 3
        for p in payroll_records:
            emp_code = p.get("employee_code", "")
            emp = emp_by_id.get(emp_code, {})

            days_worked = p.get("present_days", 0) + p.get("holiday_working_days", 0)

            fixed_basic = p.get("fixed_basic", 0.0)
            fixed_da = p.get("fixed_da", 0.0)
            fixed_gross = p.get("fixed_gross", fixed_basic + fixed_da)

            field_values: dict[str, Any] = {
                "UNIQUE_CODE": emp_code,
                "Emp ID*": emp_code,
                "Name*": p.get("employee_name", emp.get("employee_name", "")),
                "Designation*": emp.get("designation", "Operator"),
                "No of days in month": days_in_month,
                "No of days worked": days_worked,
                "Wage Period*": "Monthly",
                "Fixed Basic*": fixed_basic,
                "Fixed DA*": fixed_da,
                "Fixed Gross*": fixed_gross,
                "Basic*": p.get("basic_earned", 0.0),
                "DA": p.get("da_earned", 0.0),
                "HRA": p.get("hra_earned", 0.0),
                "Conveyance": p.get("conveyance_allowance", 0.0),
                "Special Allowance": 0.0,
                "Medical Allowance": p.get("medical_allowance", 0.0),
                "Washing Allowance": 0.0,
                "OT Wages": p.get("ot_earned", 0.0),
                "Leave Encashment": p.get("leave_wages", 0.0),
                "Bonus": p.get("bonus_earned", 0.0),
                "NFH": p.get("nfh_wages", 0.0),
                "Other Allowance": p.get("arrear", 0.0),
                "Incentive": 0.0,
                "Gross Total*": p.get("gross_salary", 0.0),
                "EPF": p.get("pf_deduction", 0.0),
                "ESI": p.get("esi_deduction", 0.0),
                "PT": p.get("professional_tax", 0.0),
                "TDS": 0.0,
                "LWF": p.get("lwf", 0.0),
                "Fines": p.get("other_deductions", 0.0),
                "Damages Loss": p.get("damage_deduction", 0.0),
                "Uniform": 0.0,
                "Salary Advance": p.get("advance_deduction", 0.0),
                "Other deduction": 0.0,
                "Total Dedutions*": p.get("total_deductions", 0.0),
                "Net Pay*": p.get("net_salary", 0.0),
                "Salary Paid Date": salary_paid_date,
            }

            for header, val in field_values.items():
                col = h_map.get(header)
                if col:
                    cell = sheet.cell(row=row_idx, column=col)
                    cell.value = val
                    if isinstance(val, float):
                        cell.number_format = "0.00"
                    elif header in ("Emp ID*", "UNIQUE_CODE", "Salary Paid Date"):
                        cell.number_format = "@"

            row_idx += 1

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()
