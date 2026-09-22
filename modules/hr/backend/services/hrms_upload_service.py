"""HRMS Upload Service — orchestration of client HRMS upload file generation.

Reads single-source-of-truth models (Employee, Attendance, Payroll, LeaveBalance, SalaryRule),
validates data, populates templates via ExcelBuilder, stores durably in platform/storage,
and logs compliance history to HRMSUploadLog.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import zipfile
from datetime import datetime
from typing import Any

from audit.services import AuditService
from django.db import transaction
from django.db.models import Max
from shared import context
from shared.exceptions import NotFoundError, ValidationError
from storage.services import StorageService

from hr.backend.models import (
    HRMSUploadLog,
    LeaveBalance,
    Payroll,
    SalaryRule,
)
from hr.backend.repositories import AttendanceRepository, EmployeeRepository
from hr.backend.services.hrms_upload.excel_builder import HRMSUploadExcelBuilder
from hr.backend.services.hrms_upload.validator import validate_hrms_upload_data

logger = logging.getLogger(__name__)

MODULE = "hr"
HRMS_UPLOAD_CATEGORY = "hrms_upload"
XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DEFAULT_CLIENT_CODE = "167948248"

ESTABLISHMENT_CONFIG = {
    "client_code": DEFAULT_CLIENT_CODE,
    "establishment_name": "WATER WORKS ENGINEERING",
    "establishment_address": (
        "#65-B, Gurusamy Nagar, Thanneerpandal, Peelamedu, Coimbatore - 641004"
    ),
    "location_of_work": (
        "Bosch Global Software Technologies Pvt Ltd, KGISL Infrastructure Pvt Ltd - SEZ, "
        "Keeranatham Village, Saravanampatti, Coimbatore - 641035"
    ),
    "state": "Tamil Nadu",
    "tenure": "Contract",
    "nature_of_work": "Operation & Maintenance (STP)",
}


class HRMSUploadService:
    def __init__(self) -> None:
        self.employee_repo = EmployeeRepository()
        self.attendance_repo = AttendanceRepository()
        self.storage = StorageService()
        self.audit = AuditService()

    def _hash_attendance(self, attendance_data: list[dict]) -> str:
        """Compute SHA-256 digest of input attendance state for idempotency tracking."""
        raw = json.dumps(attendance_data, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @transaction.atomic
    def generate(
        self,
        *,
        establishment_id: str | None = None,
        year: int,
        month: int,
        actor: Any = None,
    ) -> HRMSUploadLog:
        actor = actor or context.current_user()

        # Load domain model records
        employees_qs = list(self.employee_repo.employees_for_month(year, month))
        att_qs = list(self.attendance_repo.month_all_employees(year, month))
        payroll_qs = list(Payroll.objects.filter(year=year, month=month).select_related("employee"))

        tenant = (
            context.current_tenant()
            or (getattr(actor, "tenant", None) if actor else None)
            or (employees_qs[0].tenant if employees_qs else None)
            or (payroll_qs[0].tenant if payroll_qs else None)
        )

        if not payroll_qs:
            raise ValidationError(
                detail={
                    "payroll": [
                        f"Run payroll for {year}-{month:02d} before generating HRMS upload files."
                    ]
                }
            )

        # Build dict shapes for validator & builder
        emp_list: list[dict] = []
        for emp in employees_qs:
            emp_list.append(
                {
                    "pk": emp.pk,
                    "employee_code": emp.employee_code,
                    "employee_name": emp.employee_name,
                    "father_husband_name": emp.father_husband_name,
                    "gender": emp.gender,
                    "dob": emp.dob,
                    "address": emp.address,
                    "permanent_address": getattr(emp, "permanent_address", ""),
                    "nature_of_work": getattr(emp, "nature_of_work", ""),
                    "date_of_joining": emp.date_of_joining,
                    "date_of_leaving": emp.date_of_leaving,
                    "department": emp.department,
                    "designation": emp.designation,
                    "age": emp.age,
                    "esic_number": emp.esic_number,
                    "pf_number": emp.pf_number,
                    "uan": emp.uan,
                    "status": emp.status,
                }
            )

        # Build attendance dictionary per employee
        att_by_emp: dict[str, dict] = {}
        for r in att_qs:
            code = r.employee.employee_code
            att_by_emp.setdefault(
                code, {"employee_code": code, "employee_name": r.employee.employee_name, "days": {}}
            )["days"][r.day] = {
                "status": r.status,
                "in_time": r.in_time,
                "out_time": r.out_time,
                "ot_hours": r.ot_hours,
            }

        att_list = list(att_by_emp.values())

        # Build salary rules map for fixed rates
        salary_rules = {
            sr.employee_id: sr
            for sr in SalaryRule.objects.filter(
                effective_from__lte=datetime(year, month, 28).date()
            ).order_by("effective_from")
        }

        payroll_list: list[dict] = []
        for p in payroll_qs:
            sr = salary_rules.get(p.employee_id)
            fixed_basic = sr.basic if sr else 0.0
            fixed_da = sr.da if sr else 0.0
            fixed_gross = sr.total_monthly_salary if sr else 0.0

            payroll_list.append(
                {
                    "employee_code": p.employee.employee_code,
                    "employee_name": p.employee.employee_name,
                    "present_days": p.present_days,
                    "holiday_working_days": p.holiday_working_days,
                    "total_paid_days": p.total_paid_days,
                    "fixed_basic": fixed_basic,
                    "fixed_da": fixed_da,
                    "fixed_gross": fixed_gross,
                    "basic_earned": p.basic_earned,
                    "da_earned": p.da_earned,
                    "hra_earned": p.hra_earned,
                    "medical_allowance": p.medical_allowance,
                    "conveyance_allowance": p.conveyance_allowance,
                    "nfh_wages": p.nfh_wages,
                    "ot_earned": p.ot_earned,
                    "leave_wages": p.leave_wages,
                    "bonus_earned": p.bonus_earned,
                    "arrear": p.arrear,
                    "gross_salary": p.gross_salary,
                    "pf_deduction": p.pf_deduction,
                    "esi_deduction": p.esi_deduction,
                    "professional_tax": p.professional_tax,
                    "lwf": p.lwf,
                    "advance_deduction": p.advance_deduction,
                    "damage_deduction": p.damage_deduction,
                    "other_deductions": p.other_deductions,
                    "total_deductions": p.total_deductions,
                    "expense_reimbursement": p.expense_reimbursement,
                    "net_salary": p.net_salary,
                }
            )

        # Leave balances
        leave_balances_qs = LeaveBalance.objects.filter(year=year).select_related(
            "employee", "leave_type"
        )
        leave_balances_list = [
            {
                "employee_code": lb.employee.employee_code,
                "leave_type_code": lb.leave_type.code,
                "opening": lb.allocated,
                "credit": 0.0,
                "closing": lb.remaining,
            }
            for lb in leave_balances_qs
        ]

        # 1. Run Validations
        warnings = validate_hrms_upload_data(
            employees=emp_list,
            attendance_records=att_list,
            payroll_records=payroll_list,
            leave_records=leave_balances_list,
            year=year,
            month=month,
        )

        # 2. Build XLSX Workbooks
        builder = HRMSUploadExcelBuilder()
        hrms_bytes = builder.build_hrms_file(emp_list, year, month, ESTABLISHMENT_CONFIG)
        att_bytes = builder.build_attendance_file(att_list, emp_list, year, month)
        leave_bytes = builder.build_leave_file(att_list, leave_balances_list, emp_list, year, month)
        paysheet_bytes = builder.build_paysheet_file(
            payroll_list, emp_list, year, month, ESTABLISHMENT_CONFIG
        )

        # 3. Next Version Increment
        next_version = (
            HRMSUploadLog.objects.filter(year=year, month=month).aggregate(highest=Max("version"))[
                "highest"
            ]
            or 0
        ) + 1

        mon_yy = datetime(year, month, 1).strftime("%b-%y")  # e.g., Jun-26
        code = DEFAULT_CLIENT_CODE

        hrms_fname = f"{code}_hrms_file_{mon_yy}.xlsx"
        att_fname = f"{code}_attendance_file_{mon_yy}.xlsx"
        leave_fname = f"{code}_leave_file_{mon_yy}.xlsx"
        paysheet_fname = f"{code}_paysheet_file_{mon_yy}.xlsx"

        user_pk = actor.pk if getattr(actor, "pk", None) else None

        # Store in platform/storage
        stored_hrms = self.storage.store(
            data=hrms_bytes,
            filename=hrms_fname,
            content_type=XLSX_CONTENT_TYPE,
            module=MODULE,
            tenant=tenant,
            uploaded_by=actor if user_pk else None,
            category=HRMS_UPLOAD_CATEGORY,
            period_year=year,
            period_month=month,
        )

        stored_att = self.storage.store(
            data=att_bytes,
            filename=att_fname,
            content_type=XLSX_CONTENT_TYPE,
            module=MODULE,
            tenant=tenant,
            uploaded_by=actor if user_pk else None,
            category=HRMS_UPLOAD_CATEGORY,
            period_year=year,
            period_month=month,
        )

        stored_leave = self.storage.store(
            data=leave_bytes,
            filename=leave_fname,
            content_type=XLSX_CONTENT_TYPE,
            module=MODULE,
            tenant=tenant,
            uploaded_by=actor if user_pk else None,
            category=HRMS_UPLOAD_CATEGORY,
            period_year=year,
            period_month=month,
        )

        stored_paysheet = self.storage.store(
            data=paysheet_bytes,
            filename=paysheet_fname,
            content_type=XLSX_CONTENT_TYPE,
            module=MODULE,
            tenant=tenant,
            uploaded_by=actor if user_pk else None,
            category=HRMS_UPLOAD_CATEGORY,
            period_year=year,
            period_month=month,
        )

        att_hash = self._hash_attendance(att_list)

        log = HRMSUploadLog.objects.create(
            tenant=tenant,
            year=year,
            month=month,
            version=next_version,
            client_code=code,
            attendance_hash=att_hash,
            stored_hrms=stored_hrms,
            stored_attendance=stored_att,
            stored_leave=stored_leave,
            stored_paysheet=stored_paysheet,
            warnings=warnings,
            generated_by=actor if user_pk else None,
        )

        self.audit.record(
            action="hr.hrms_upload.generated",
            module=MODULE,
            object_type="HRMSUploadLog",
            object_id=str(log.pk),
            changes={
                "period": f"{year}-{month:02d}",
                "version": next_version,
                "warnings_count": len(warnings),
            },
        )

        logger.info(
            "Generated HRMS upload files for %s-%02d v%d with %d warnings",
            year,
            month,
            next_version,
            len(warnings),
        )

        return log

    def latest_log(self, year: int, month: int) -> HRMSUploadLog | None:
        return HRMSUploadLog.objects.filter(year=year, month=month).order_by("-version").first()

    def download(self, log: HRMSUploadLog, file_type: str) -> tuple[bytes, str]:
        mon_yy = datetime(log.year, log.month, 1).strftime("%b-%y")
        code = log.client_code

        if file_type == "hrms":
            if not log.stored_hrms:
                raise NotFoundError("HRMS file not found.")
            return self.storage.open(log.stored_hrms), f"{code}_hrms_file_{mon_yy}.xlsx"

        if file_type == "attendance":
            if not log.stored_attendance:
                raise NotFoundError("Attendance file not found.")
            return self.storage.open(log.stored_attendance), f"{code}_attendance_file_{mon_yy}.xlsx"

        if file_type == "leave":
            if not log.stored_leave:
                raise NotFoundError("Leave file not found.")
            return self.storage.open(log.stored_leave), f"{code}_leave_file_{mon_yy}.xlsx"

        if file_type == "paysheet":
            if not log.stored_paysheet:
                raise NotFoundError("Paysheet file not found.")
            return self.storage.open(log.stored_paysheet), f"{code}_paysheet_file_{mon_yy}.xlsx"

        if file_type == "zip":
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                if log.stored_hrms:
                    zf.writestr(
                        f"{code}_hrms_file_{mon_yy}.xlsx", self.storage.open(log.stored_hrms)
                    )
                if log.stored_attendance:
                    zf.writestr(
                        f"{code}_attendance_file_{mon_yy}.xlsx",
                        self.storage.open(log.stored_attendance),
                    )
                if log.stored_leave:
                    zf.writestr(
                        f"{code}_leave_file_{mon_yy}.xlsx", self.storage.open(log.stored_leave)
                    )
                if log.stored_paysheet:
                    zf.writestr(
                        f"{code}_paysheet_file_{mon_yy}.xlsx",
                        self.storage.open(log.stored_paysheet),
                    )

            return buf.getvalue(), f"{code}_hrms_upload_package_{mon_yy}_v{log.version}.zip"

        raise ValidationError(detail={"file_type": [f"Invalid file_type '{file_type}'."]})
