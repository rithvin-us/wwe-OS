"""Validator for HRMS Upload generation.

Performs hard checks (raising ValidationError 422 if failed) and soft checks
(returning warnings list).
"""

from __future__ import annotations

import re
from datetime import date

from shared.exceptions import ValidationError


def validate_hrms_upload_data(
    employees: list[dict],
    attendance_records: list[dict],
    payroll_records: list[dict],
    leave_records: list[dict],
    year: int,
    month: int,
) -> list[str]:
    """Execute hard and soft validation checks."""
    warnings: list[str] = []

    # Maps for lookup
    emp_by_id = {emp["employee_code"]: emp for emp in employees if emp.get("employee_code")}
    paysheet_by_id = {p["employee_code"]: p for p in payroll_records if p.get("employee_code")}

    # ─── HARD CHECKS ─────────────────────────────────────────────────────────────

    # 1. Every Emp ID in paysheet, attendance, and leave exists in hrms_file
    hrms_emp_ids = set(emp_by_id.keys())

    for p in payroll_records:
        emp_code = p.get("employee_code")
        if emp_code and emp_code not in hrms_emp_ids:
            raise ValidationError(
                detail={
                    "hrms_upload": [
                        f"Hard Check Failed: Employee ID {emp_code} in paysheet "
                        "is missing from HRMS Master snapshot."
                    ]
                }
            )

    for att in attendance_records:
        emp_code = att.get("employee_code")
        if emp_code and emp_code not in hrms_emp_ids:
            raise ValidationError(
                detail={
                    "hrms_upload": [
                        f"Hard Check Failed: Employee ID {emp_code} in attendance "
                        "is missing from HRMS Master snapshot."
                    ]
                }
            )

    for l_rec in leave_records:
        emp_code = l_rec.get("employee_code")
        if emp_code and emp_code not in hrms_emp_ids:
            raise ValidationError(
                detail={
                    "hrms_upload": [
                        f"Hard Check Failed: Employee ID {emp_code} in leave records "
                        "is missing from HRMS Master snapshot."
                    ]
                }
            )

    # 2. Per employee math hard checks
    for p in payroll_records:
        emp_code = p.get("employee_code", "Unknown")

        basic = p.get("basic_earned", 0.0)
        da = p.get("da_earned", 0.0)
        hra = p.get("hra_earned", 0.0)
        medical = p.get("medical_allowance", 0.0)
        conveyance = p.get("conveyance_allowance", 0.0)
        nfh = p.get("nfh_wages", 0.0)
        ot = p.get("ot_earned", 0.0)
        other_allowance = (
            p.get("arrear", 0.0) + p.get("leave_wages", 0.0) + p.get("bonus_earned", 0.0)
        )
        gross = p.get("gross_salary", 0.0)

        calc_gross = round(basic + da + hra + medical + conveyance + nfh + ot + other_allowance, 2)
        if abs(calc_gross - round(gross, 2)) > 0.05:
            raise ValidationError(
                detail={
                    "hrms_upload": [
                        f"Hard Check Failed for Emp {emp_code}: "
                        f"basic({basic}) + da({da}) + hra({hra}) + "
                        f"medical({medical}) + conveyance({conveyance}) + "
                        f"nfh({nfh}) + ot({ot}) + other({other_allowance}) "
                        f"== {calc_gross} != gross({gross})"
                    ]
                }
            )

        pf = p.get("pf_deduction", 0.0)
        esi = p.get("esi_deduction", 0.0)
        pt = p.get("professional_tax", 0.0)
        lwf = p.get("lwf", 0.0)
        advance = p.get("advance_deduction", 0.0)
        damage = p.get("damage_deduction", 0.0)
        other_ded = p.get("other_deductions", 0.0)
        total_ded = p.get("total_deductions", 0.0)

        calc_ded = round(pf + esi + pt + lwf + advance + damage + other_ded, 2)
        if abs(calc_ded - round(total_ded, 2)) > 0.05:
            raise ValidationError(
                detail={
                    "hrms_upload": [
                        f"Hard Check Failed for Emp {emp_code}: "
                        f"Sum of deductions ({calc_ded}) != total_deductions ({total_ded})"
                    ]
                }
            )

        net = p.get("net_salary", 0.0)
        exp_reimb = p.get("expense_reimbursement", 0.0)
        if abs((gross - total_ded + exp_reimb) - net) > 1e-5:
            raise ValidationError(
                detail={
                    "hrms_upload": [
                        f"Hard Check Failed for Emp {emp_code}: "
                        f"gross({gross}) - total_ded({total_ded}) + exp({exp_reimb}) != net({net})"
                    ]
                }
            )

    # 3. Attendance days_worked == paysheet days_worked
    for att in attendance_records:
        emp_code = att.get("employee_code")
        days = att.get("days", {})
        p_count = sum(1 for d_info in days.values() if d_info.get("status") in ("P", "HD"))
        wd_count = sum(1 for d_info in days.values() if d_info.get("status") == "W/D")
        att_days_worked = p_count + wd_count

        p_row = paysheet_by_id.get(emp_code)
        if p_row:
            p_days_worked = p_row.get("present_days", 0) + p_row.get("holiday_working_days", 0)
            if att_days_worked != p_days_worked:
                raise ValidationError(
                    detail={
                        "hrms_upload": [
                            f"Hard Check Failed for Emp {emp_code}: "
                            f"Attendance days worked ({att_days_worked}) != "
                            f"Paysheet days worked ({p_days_worked})"
                        ]
                    }
                )

    # ─── SOFT CHECKS (WARNINGS) ───────────────────────────────────────────────────

    for emp in employees:
        emp_code = emp.get("employee_code", "Unknown")

        if not emp.get("employee_code") or emp.get("is_auto_assigned_id"):
            warnings.append(f"Emp ID for {emp.get('employee_name')} was auto-assigned or missing.")

        if not emp.get("dob"):
            warnings.append(
                f"Emp {emp_code} ({emp.get('employee_name')}): Required field DOB is missing."
            )
        else:
            dob_val = emp["dob"]
            if isinstance(dob_val, date):
                today = date(year, month, 28)
                computed_age = (
                    today.year
                    - dob_val.year
                    - ((today.month, today.day) < (dob_val.month, dob_val.day))
                )
                stored_age = emp.get("age")
                if stored_age is not None and stored_age != computed_age:
                    warnings.append(
                        f"Emp {emp_code}: Stored age ({stored_age}) differs "
                        f"from computed age ({computed_age})."
                    )

        if not emp.get("address"):
            warnings.append(f"Emp {emp_code}: Required field Present Address is missing.")

        if not emp.get("father_husband_name"):
            warnings.append(f"Emp {emp_code}: Required field Father/Husband Name is missing.")

        esic = emp.get("esic_number", "").strip()
        if not esic or esic in ("NEW JOINING", "NESI"):
            warnings.append(f"Emp {emp_code}: ESI number is unassigned/blank ('{esic}').")

        uan = emp.get("uan", "").strip() or emp.get("pf_number", "").strip()
        if not uan or uan in ("NEW JOINING", "NPF"):
            warnings.append(f"Emp {emp_code}: UAN/PF number is unassigned/blank ('{uan}').")

        pres_addr = emp.get("address", "").strip()
        perm_addr = emp.get("permanent_address", "").strip()
        if pres_addr and perm_addr and pres_addr != perm_addr:
            pres_clean = re.sub(r"\d{6}", "", pres_addr).strip()
            perm_clean = re.sub(r"\d{6}", "", perm_addr).strip()
            if pres_clean == perm_clean:
                warnings.append(
                    f"Emp {emp_code}: Present address and Permanent address differ "
                    "only by pincode (possible drag-fill typo)."
                )

    for att in attendance_records:
        emp_code = att.get("employee_code")
        emp = emp_by_id.get(emp_code, {})
        master_name = emp.get("employee_name", "").strip().upper()
        att_name = att.get("employee_name", "").strip().upper()

        if master_name and att_name and master_name != att_name:
            warnings.append(
                f"Emp {emp_code}: Name mismatch between Master ('{master_name}') "
                f"and Attendance ('{att_name}')."
            )

        days = att.get("days", {})
        has_long_absent = any(d.get("status") == "LONG_ABSENT" for d in days.values())
        if has_long_absent and not emp.get("date_of_leaving"):
            warnings.append(f"Emp {emp_code}: Marked LONG_ABSENT but has no Date of Leaving (DOL).")

        doj = emp.get("date_of_joining")
        dol = emp.get("date_of_leaving")
        if isinstance(doj, date):
            for d in range(1, 32):
                try:
                    curr_date = date(year, month, d)
                except ValueError:
                    break
                if (curr_date >= doj and (not dol or curr_date <= dol)) and (
                    d not in days or not days[d].get("status")
                ):
                    warnings.append(
                        f"Emp {emp_code}: Unmarked attendance day {d} "
                        f"between DOJ ({doj}) and DOL ({dol or 'Active'})."
                    )

    return warnings
