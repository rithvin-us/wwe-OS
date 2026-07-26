"""The legacy-database importer.

The real legacy database available at migration time carried no HR business rows
(see docs/specs/hr-migration.md § 8), so these tests build a synthetic legacy
sqlite with the legacy schema and import from it. That is the only way to prove
the column mapping, the idempotency and the "never touch the source" guarantee
actually hold.
"""

from __future__ import annotations

import sqlite3

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from hr.backend.models import Attendance, Employee, Holiday, Payroll, PayRulesConfig, SalaryRule

pytestmark = pytest.mark.django_db


LEGACY_SCHEMA = """
CREATE TABLE employees (
    id INTEGER PRIMARY KEY, employee_code TEXT, employee_name TEXT,
    father_husband_name TEXT, gender TEXT, dob DATE, address TEXT, phone TEXT,
    designation TEXT, department TEXT, date_of_joining DATE, date_of_leaving DATE,
    salary REAL, pf_number TEXT, uan TEXT, esic_number TEXT, bank_name TEXT,
    bank_account TEXT, ifsc_code TEXT, status TEXT, skill_category TEXT,
    location TEXT, shift TEXT, face_embedding TEXT, enrolled_at TIMESTAMP
);
CREATE TABLE pay_rules_config (
    id INTEGER PRIMARY KEY, effective_from DATE, effective_to DATE,
    standard_days_per_month INTEGER, standard_hours_per_day INTEGER,
    ot_multiplier REAL, pf_employee_percent REAL, pf_employer_percent REAL,
    pf_cap REAL, esi_employee_percent REAL, esi_employer_percent REAL,
    esi_wage_ceiling REAL, esi_cap REAL, lwf_employee REAL, lwf_employer REAL,
    description TEXT
);
CREATE TABLE holidays (id INTEGER PRIMARY KEY, date DATE, name TEXT, type TEXT, year INTEGER);
CREATE TABLE salary_rules (
    id INTEGER PRIMARY KEY, employee_id INTEGER, wage_type TEXT, basic REAL,
    da REAL, hra REAL, medical_allowance REAL, conveyance_allowance REAL,
    ot_rate REAL, effective_from DATE, effective_to DATE
);
CREATE TABLE attendance (
    id INTEGER PRIMARY KEY, employee_id INTEGER, year INTEGER, month INTEGER,
    day INTEGER, status TEXT, shift TEXT, in_time TEXT, out_time TEXT,
    worked_hours REAL, ot_hours REAL
);
CREATE TABLE deductions (
    id INTEGER PRIMARY KEY, employee_id INTEGER, year INTEGER, month INTEGER,
    type TEXT, date_of_payment DATE, amount REAL, installments INTEGER,
    recovery_date DATE, recovery_amount REAL, is_recovered INTEGER,
    damage_description TEXT, showcause_date DATE, act_or_omission TEXT,
    description TEXT
);
CREATE TABLE payroll (
    id INTEGER PRIMARY KEY, employee_id INTEGER, year INTEGER, month INTEGER,
    present_days INTEGER, leave_days INTEGER, holiday_days INTEGER,
    holiday_working_days INTEGER, week_off_days INTEGER, total_paid_days INTEGER,
    absent_days INTEGER, ot_hours REAL, basic_earned REAL, da_earned REAL,
    hra_earned REAL, medical_allowance REAL, conveyance_allowance REAL,
    nfh_wages REAL, ot_earned REAL, leave_wages REAL, bonus_earned REAL,
    arrear REAL, gross_salary REAL, pf_deduction REAL, esi_deduction REAL,
    professional_tax REAL, lwf REAL, advance_deduction REAL,
    damage_deduction REAL, other_deductions REAL, total_deductions REAL,
    expense_reimbursement REAL, net_salary REAL
);
CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, hashed_password TEXT);
CREATE TABLE audit_logs (id INTEGER PRIMARY KEY, entity_type TEXT, action TEXT, user TEXT);
CREATE TABLE device_tokens (id INTEGER PRIMARY KEY, token TEXT);
"""


@pytest.fixture
def legacy_db(tmp_path):
    """A synthetic legacy database with one employee's full month."""
    path = tmp_path / "legacy.db"
    con = sqlite3.connect(path)
    con.executescript(LEGACY_SCHEMA)

    con.execute(
        "INSERT INTO employees (id, employee_code, employee_name, gender, designation,"
        " department, date_of_joining, salary, pf_number, uan, esic_number, status,"
        " skill_category, location, shift, face_embedding)"
        " VALUES (1, 'C-0065', 'Ramesh Kumar', 'M', 'Operator', 'Production',"
        " '2024-01-15', 15000, 'PF-1', 'UAN-1', 'ESIC-1', 'Active', 'Skilled',"
        " 'Coimbatore', 'G', '[0.1,0.2]')"
    )
    con.execute(
        "INSERT INTO employees (id, employee_code, employee_name, date_of_joining,"
        " date_of_leaving, status) VALUES (2, 'C-0066', 'Left Person', '2023-01-01',"
        " '2025-06-30', 'Left')"
    )
    con.execute(
        "INSERT INTO pay_rules_config (id, effective_from, standard_days_per_month,"
        " standard_hours_per_day, ot_multiplier, pf_employee_percent, pf_cap,"
        " esi_employee_percent, esi_wage_ceiling, esi_cap, description)"
        " VALUES (1, '2020-04-01', 26, 8, 2.0, 12.0, 1800.0, 0.75, 21000.0, 158.0, 'Legacy')"
    )
    con.execute(
        "INSERT INTO holidays (id, date, name, type, year)"
        " VALUES (1, '2026-01-26', 'Republic Day', 'National', 2026)"
    )
    con.execute(
        "INSERT INTO salary_rules (id, employee_id, wage_type, basic, da, hra,"
        " medical_allowance, conveyance_allowance, ot_rate, effective_from)"
        " VALUES (1, 1, 'Monthly', 7500, 3750, 2250, 600, 900, 0, '2024-01-15')"
    )
    con.execute(
        "INSERT INTO attendance (id, employee_id, year, month, day, status, shift,"
        " in_time, out_time, worked_hours, ot_hours)"
        " VALUES (1, 1, 2026, 4, 1, 'P', 'N', '22:00', '07:00', 9.0, 1.0)"
    )
    con.execute(
        "INSERT INTO attendance (id, employee_id, year, month, day, status, shift)"
        " VALUES (2, 1, 2026, 4, 2, 'CL', 'G')"
    )
    # An orphan row: its employee is not in the export. Must be skipped, not crash.
    con.execute(
        "INSERT INTO attendance (id, employee_id, year, month, day, status)"
        " VALUES (3, 999, 2026, 4, 3, 'P')"
    )
    con.execute(
        "INSERT INTO deductions (id, employee_id, year, month, type, amount,"
        " recovery_amount, is_recovered, description)"
        " VALUES (1, 1, 2026, 4, 'Advance', 2000, 500, 0, 'Festival advance')"
    )
    con.execute(
        "INSERT INTO payroll (id, employee_id, year, month, present_days, total_paid_days,"
        " ot_hours, basic_earned, da_earned, gross_salary, pf_deduction, esi_deduction,"
        " total_deductions, net_salary)"
        " VALUES (1, 1, 2026, 4, 26, 26, 1.0, 7500, 3750, 15000, 1350, 113, 1463, 13537)"
    )
    # Never imported — identity and audit stay with their owning systems.
    con.execute("INSERT INTO users (id, username, hashed_password) VALUES (1, 'admin', 'x')")
    con.execute(
        "INSERT INTO audit_logs (id, entity_type, action, user)"
        " VALUES (1, 'Employee', 'CREATE', 'admin')"
    )
    con.commit()
    con.close()
    return path


class TestDryRun:
    def test_a_dry_run_writes_nothing(self, legacy_db, tenant):
        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug)

        assert Employee.objects.count() == 0
        assert Attendance.objects.count() == 0
        assert Payroll.objects.count() == 0

    def test_an_unknown_tenant_is_refused(self, legacy_db, db):
        with pytest.raises(CommandError):
            call_command("import_legacy_hr", source=str(legacy_db), tenant="nope")

    def test_a_missing_source_is_refused(self, tenant, tmp_path):
        with pytest.raises(CommandError):
            call_command("import_legacy_hr", source=str(tmp_path / "absent.db"), tenant=tenant.slug)


class TestImport:
    def test_employees_come_across_with_their_fields(self, legacy_db, tenant):
        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug, commit=True)

        employee = Employee.objects.get(employee_code="C-0065")
        assert employee.employee_name == "Ramesh Kumar"
        assert employee.department == "Production"
        assert employee.salary == 15000.0
        assert employee.skill_category == "Skilled"
        assert employee.shift == "G"
        # The face template carries across so nobody has to re-enrol.
        assert employee.face_embedding == "[0.1,0.2]"
        assert employee.tenant == tenant

    def test_people_who_left_are_preserved_not_dropped(self, legacy_db, tenant):
        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug, commit=True)

        left = Employee.objects.get(employee_code="C-0066")
        assert left.status == "Left"
        assert str(left.date_of_leaving) == "2025-06-30"
        assert left.is_active is False

    def test_attendance_keeps_its_stored_per_day_values(self, legacy_db, tenant):
        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug, commit=True)

        night = Attendance.objects.get(day=1, month=4, year=2026)
        # Recomputing these would silently restate history, so they come across as-is.
        assert night.shift == "N"
        assert night.in_time == "22:00"
        assert night.out_time == "07:00"
        assert night.worked_hours == 9.0
        assert night.ot_hours == 1.0

    def test_an_orphan_row_is_skipped_not_fatal(self, legacy_db, tenant):
        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug, commit=True)

        # Two importable days; the third referenced a missing employee.
        assert Attendance.objects.count() == 2

    def test_supporting_tables_come_across(self, legacy_db, tenant):
        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug, commit=True)

        assert PayRulesConfig.objects.get().standard_days_per_month == 26
        assert Holiday.objects.get().name == "Republic Day"
        rule = SalaryRule.objects.get()
        assert rule.total_monthly_salary == 15000.0
        payroll = Payroll.objects.get()
        assert payroll.net_salary == 13537.0
        assert payroll.gross_salary == 15000.0

    def test_identity_and_audit_are_not_imported(self, legacy_db, tenant):
        from audit.models import AuditLog
        from users.models import User

        before_users = User.objects.count()
        before_audit = AuditLog.objects.count()

        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug, commit=True)

        # WWE OS owns identity; the legacy audit trail stays with its own system.
        assert User.objects.count() == before_users
        assert AuditLog.objects.count() == before_audit


class TestIdempotencyAndSafety:
    def test_running_twice_does_not_duplicate(self, legacy_db, tenant):
        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug, commit=True)
        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug, commit=True)

        assert Employee.objects.count() == 2
        assert Attendance.objects.count() == 2
        assert Payroll.objects.count() == 1
        assert SalaryRule.objects.count() == 1
        assert Holiday.objects.count() == 1

    def test_the_source_database_is_never_modified(self, legacy_db, tenant):
        before = legacy_db.read_bytes()

        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug, commit=True)

        assert legacy_db.read_bytes() == before

    def test_a_second_run_picks_up_changes_made_meanwhile(self, legacy_db, tenant):
        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug, commit=True)

        # The operator keeps using the legacy app for a few more days.
        con = sqlite3.connect(legacy_db)
        con.execute("UPDATE employees SET department = 'Maintenance' WHERE id = 1")
        con.execute(
            "INSERT INTO attendance (id, employee_id, year, month, day, status, shift)"
            " VALUES (4, 1, 2026, 4, 4, 'P', 'G')"
        )
        con.commit()
        con.close()

        call_command("import_legacy_hr", source=str(legacy_db), tenant=tenant.slug, commit=True)

        assert Employee.objects.get(employee_code="C-0065").department == "Maintenance"
        assert Attendance.objects.count() == 3
