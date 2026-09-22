"""Tests for HRMS Upload file auto-generation.

Exercises template integrity, golden data calculations, leave range grouping,
DOB text formatting, hard/soft validations, and endpoints.
"""

from __future__ import annotations

import io
import zipfile
from datetime import date

import openpyxl
import pytest
from rest_framework import status

from hr.backend.models import (
    Attendance,
    Employee,
    Payroll,
    SalaryRule,
)
from hr.backend.services.hrms_upload.excel_builder import (
    _group_leave_ranges,
)
from hr.backend.services.hrms_upload_service import HRMSUploadService

pytestmark = pytest.mark.django_db

ESTABLISHMENT_ID = "167948248"


class TestHRMSUploadGoldenData:
    """Golden data assertions from Section 8 of spec."""

    def test_anish_jun_26_payroll_and_upload(self, tenant, pay_rules):
        # Anish, Jun-26: paid_days 10 -> basic 2626.54, DA 2828.08, HRA 1083.85,
        # gross 6538.46, EPF 655, ESI 50, net 5833.46
        anish = Employee.objects.create(
            tenant=tenant,
            employee_code="C-0101",
            employee_name="ANISH",
            date_of_joining=date(2025, 1, 1),
            dob=date(1998, 5, 15),
            pf_number="PF101",
            esic_number="ESI101",
            salary=17000.0,
        )
        SalaryRule.objects.create(
            tenant=tenant,
            employee=anish,
            basic=6829.0,
            da=7353.0,
            hra=2818.0,
            effective_from=date(2025, 1, 1),
        )

        Payroll.objects.create(
            tenant=tenant,
            employee=anish,
            year=2026,
            month=6,
            present_days=8,
            holiday_days=1,
            leave_days=1,
            total_paid_days=10,
            basic_earned=2626.54,
            da_earned=2828.08,
            hra_earned=1083.85,
            gross_salary=6538.46,
            pf_deduction=655.0,
            esi_deduction=50.0,
            total_deductions=705.0,
            net_salary=5833.46,
        )

        for d in range(1, 9):
            Attendance.objects.create(
                tenant=tenant, employee=anish, year=2026, month=6, day=d, status="P"
            )

        service = HRMSUploadService()
        log = service.generate(establishment_id=ESTABLISHMENT_ID, year=2026, month=6)

        assert log.version == 1
        data, fname = service.download(log, "paysheet")
        wb = openpyxl.load_workbook(io.BytesIO(data))
        sheet = wb.active

        # Row 3 is Anish
        assert sheet.cell(row=3, column=2).value == "C-0101"
        assert sheet.cell(row=3, column=11).value == 2626.54
        assert sheet.cell(row=3, column=12).value == 2828.08
        assert sheet.cell(row=3, column=13).value == 1083.85
        assert sheet.cell(row=3, column=24).value == 6538.46
        assert sheet.cell(row=3, column=25).value == 655.0
        assert sheet.cell(row=3, column=26).value == 50.0
        assert sheet.cell(row=3, column=36).value == 5833.46

    def test_elanchezliyan_may_26(self, tenant, pay_rules):
        # Elanchezliyan, May-26: gross 22231.08 (incl. OT 20 hrs = 3269.23 and NFH 1308),
        # EPF 1800, ESI 158, net 20273.08
        ela = Employee.objects.create(
            tenant=tenant,
            employee_code="C-0102",
            employee_name="ELANCHEZLIYAN",
            date_of_joining=date(2024, 1, 1),
            pf_number="PF102",
            esic_number="ESI102",
        )
        SalaryRule.objects.create(
            tenant=tenant,
            employee=ela,
            basic=8000.0,
            da=5000.0,
            hra=4000.0,
            effective_from=date(2024, 1, 1),
        )

        Payroll.objects.create(
            tenant=tenant,
            employee=ela,
            year=2026,
            month=5,
            present_days=26,
            total_paid_days=26,
            basic_earned=8000.0,
            da_earned=5000.0,
            hra_earned=4653.85,
            ot_hours=20.0,
            ot_earned=3269.23,
            nfh_wages=1308.0,
            gross_salary=22231.08,
            pf_deduction=1800.0,
            esi_deduction=158.0,
            total_deductions=1958.0,
            net_salary=20273.08,
        )

        service = HRMSUploadService()
        log = service.generate(establishment_id=ESTABLISHMENT_ID, year=2026, month=5)

        data, _ = service.download(log, "paysheet")
        wb = openpyxl.load_workbook(io.BytesIO(data))
        sheet = wb.active

        assert sheet.cell(row=3, column=24).value == 22231.08
        assert sheet.cell(row=3, column=25).value == 1800.0
        assert sheet.cell(row=3, column=26).value == 158.0
        assert sheet.cell(row=3, column=36).value == 20273.08

    def test_prakash_may_26(self, tenant, pay_rules):
        # Prakash, May-26: fixed gross 19007 (HRA 4825), paid_days 8,
        # gross 5848.31, EPF 524, ESI 44, net 5280.31, DOL 12-05-2026
        prakash = Employee.objects.create(
            tenant=tenant,
            employee_code="C-0103",
            employee_name="PRAKASH",
            date_of_joining=date(2024, 1, 1),
            date_of_leaving=date(2026, 5, 12),
            pf_number="PF103",
            esic_number="ESI103",
        )
        SalaryRule.objects.create(
            tenant=tenant,
            employee=prakash,
            basic=7000.0,
            da=7182.0,
            hra=4825.0,
            effective_from=date(2024, 1, 1),
        )

        Payroll.objects.create(
            tenant=tenant,
            employee=prakash,
            year=2026,
            month=5,
            present_days=7,
            holiday_days=1,
            total_paid_days=8,
            basic_earned=2153.85,
            da_earned=2209.85,
            hra_earned=1484.61,
            gross_salary=5848.31,
            pf_deduction=524.0,
            esi_deduction=44.0,
            total_deductions=568.0,
            net_salary=5280.31,
        )

        service = HRMSUploadService()
        log = service.generate(establishment_id=ESTABLISHMENT_ID, year=2026, month=5)

        data, _ = service.download(log, "hrms")
        wb = openpyxl.load_workbook(io.BytesIO(data))
        sheet = wb.active

        # DOL column (col 10) formatted as text "12-05-2026"
        assert sheet.cell(row=3, column=10).value == "12-05-2026"

    def test_gokul_jun_26_uncovered(self, tenant, pay_rules):
        # Gokul, Jun-26: pf/esi not covered -> EPF 0, ESI 0, net = gross 2615.38
        gokul = Employee.objects.create(
            tenant=tenant,
            employee_code="C-0104",
            employee_name="GOKUL",
            date_of_joining=date(2026, 1, 1),
            pf_number="NPF",
            esic_number="NESI",
        )
        SalaryRule.objects.create(
            tenant=tenant,
            employee=gokul,
            basic=6829.0,
            da=0.0,
            hra=0.0,
            effective_from=date(2026, 1, 1),
        )

        Payroll.objects.create(
            tenant=tenant,
            employee=gokul,
            year=2026,
            month=6,
            present_days=10,
            total_paid_days=10,
            basic_earned=2615.38,
            gross_salary=2615.38,
            pf_deduction=0.0,
            esi_deduction=0.0,
            total_deductions=0.0,
            net_salary=2615.38,
        )

        service = HRMSUploadService()
        log = service.generate(establishment_id=ESTABLISHMENT_ID, year=2026, month=6)

        data, _ = service.download(log, "paysheet")
        wb = openpyxl.load_workbook(io.BytesIO(data))
        sheet = wb.active

        assert sheet.cell(row=3, column=25).value == 0.0
        assert sheet.cell(row=3, column=26).value == 0.0
        assert sheet.cell(row=3, column=36).value == 2615.38


class TestTemplateIntegrityAndFormatting:
    def test_leave_range_grouping(self):
        # PL on 2nd + L on 8th–26th -> From "02-06-2026, 08-06-2026", To "02-06-2026, 26-06-2026"
        days = {
            2: {"status": "PL"},
            8: {"status": "L"},
            9: {"status": "L"},
            10: {"status": "L"},
            26: {"status": "L"},
        }
        # Mark 8..26 as L
        for d in range(8, 27):
            days[d] = {"status": "L"}

        from_str, to_str = _group_leave_ranges(days, year=2026, month=6)
        assert from_str == "02-06-2026, 08-06-2026"
        assert to_str == "02-06-2026, 26-06-2026"

    def test_dob_is_written_as_text_not_datetime(self, tenant, pay_rules):
        emp = Employee.objects.create(
            tenant=tenant,
            employee_code="C-0105",
            employee_name="TEST DOB",
            dob=date(2002, 10, 12),
            date_of_joining=date(2025, 1, 1),
        )
        Payroll.objects.create(
            tenant=tenant,
            employee=emp,
            year=2026,
            month=6,
            basic_earned=1000.0,
            gross_salary=1000.0,
            net_salary=1000.0,
        )

        service = HRMSUploadService()
        log = service.generate(establishment_id=ESTABLISHMENT_ID, year=2026, month=6)

        data, _ = service.download(log, "hrms")
        wb = openpyxl.load_workbook(io.BytesIO(data))
        sheet = wb.active

        # DOB is column 6 ("DOB\n(DD-MM-YYYY)*")
        dob_cell = sheet.cell(row=3, column=6)
        assert dob_cell.value == "12-10-2002"
        assert isinstance(dob_cell.value, str)

    def test_zip_download(self, tenant, pay_rules):
        emp = Employee.objects.create(
            tenant=tenant,
            employee_code="C-0106",
            employee_name="TEST ZIP",
            date_of_joining=date(2025, 1, 1),
        )
        Payroll.objects.create(
            tenant=tenant,
            employee=emp,
            year=2026,
            month=6,
            basic_earned=1000.0,
            gross_salary=1000.0,
            net_salary=1000.0,
        )

        service = HRMSUploadService()
        log = service.generate(establishment_id=ESTABLISHMENT_ID, year=2026, month=6)

        data, fname = service.download(log, "zip")
        assert fname.endswith(".zip")

        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            namelist = zf.namelist()
            assert any("hrms_file" in name for name in namelist)
            assert any("attendance_file" in name for name in namelist)
            assert any("leave_file" in name for name in namelist)
            assert any("paysheet_file" in name for name in namelist)

    def test_hard_check_math_mismatch_raises_validation_error(self, tenant, pay_rules):
        emp = Employee.objects.create(
            tenant=tenant,
            employee_code="C-0107",
            employee_name="BAD MATH",
            date_of_joining=date(2025, 1, 1),
        )
        Payroll.objects.create(
            tenant=tenant,
            employee=emp,
            year=2026,
            month=6,
            basic_earned=1000.0,
            gross_salary=1000.0,
            total_deductions=100.0,
            net_salary=800.0,  # 1000 - 100 != 800 (mismatch!)
        )

        service = HRMSUploadService()
        with pytest.raises(Exception) as exc_info:
            service.generate(establishment_id=ESTABLISHMENT_ID, year=2026, month=6)
        assert "Hard Check Failed" in str(exc_info.value)


class TestHRMSUploadAPIEndpoints:
    def test_generate_and_download_endpoints(
        self, auth_client, owner, employee_factory, salary_rule_factory, pay_rules
    ):
        emp = employee_factory(doj=date(2025, 1, 1))
        salary_rule_factory(employee=emp)

        client = auth_client(owner)
        client.post("/api/v1/hr/payroll/run/", {"year": 2026, "month": 6}, format="json")

        gen_url = f"/api/v1/hr/compliance/{ESTABLISHMENT_ID}/2026/6/hrms-upload/generate/"
        res = client.post(gen_url, format="json")
        assert res.status_code == status.HTTP_200_OK
        data = res.data
        assert data["version"] == 1
        assert "files" in data

        status_url = f"/api/v1/hr/compliance/{ESTABLISHMENT_ID}/2026/6/hrms-upload/"
        res_status = client.get(status_url)
        assert res_status.status_code == status.HTTP_200_OK
        assert res_status.data["status"] == "generated"

        dl_url = f"/api/v1/hr/compliance/{ESTABLISHMENT_ID}/2026/6/hrms-upload/download/?type=zip"
        res_dl = client.get(dl_url)
        assert res_dl.status_code == status.HTTP_200_OK
        assert res_dl.headers["Content-Type"] == "application/zip"
