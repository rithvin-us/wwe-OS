"""The migrated monthly cycle, end to end: master → attendance → payroll.

These assert the *behaviours the legacy app had*, not just that the endpoints
respond — the auto-created salary rule, the NJ/LEFT back-fills, the standard
shift window filled in for a bare Present day, and monthly OT being the sum of
the stored daily OT.
"""

from __future__ import annotations

from datetime import date

import pytest

from hr.backend.models import Attendance, Employee, Payroll, SalaryRule

pytestmark = pytest.mark.django_db


EMPLOYEES_URL = "/api/v1/hr/employees/"
ATTENDANCE_URL = "/api/v1/hr/attendance/"
PAYROLL_URL = "/api/v1/hr/payroll/"
PAYROLL_RUN_URL = "/api/v1/hr/payroll/run/"


def _new_employee_payload(**overrides) -> dict:
    payload = {
        "employee_code": "C-0065",
        "employee_name": "Ramesh Kumar",
        "date_of_joining": "2026-04-01",
        "salary": 15000,
        "pf_number": "PF-1",
        "uan": "UAN-1",
        "esic_number": "ESIC-1",
        "shift": "G",
    }
    payload.update(overrides)
    return payload


class TestEmployeeMaster:
    def test_create_employee_auto_creates_default_salary_rule(self, auth_client, owner):
        client = auth_client(owner)

        response = client.post(EMPLOYEES_URL, _new_employee_payload(), format="json")

        assert response.status_code == 201, response.data
        employee = Employee.objects.get(employee_code="C-0065")

        # Payroll skips employees with no rule, so creation must leave one behind.
        rule = SalaryRule.objects.get(employee=employee)
        assert rule.basic == 7500.0  # 50%
        assert rule.da == 3750.0  # 25%
        assert rule.hra == 2250.0  # 15%
        assert rule.conveyance_allowance == 900.0  # 6%
        assert rule.medical_allowance == 600.0  # 4%
        assert rule.total_monthly_salary == 15000.0
        assert rule.effective_from == employee.date_of_joining

    def test_mid_month_joiner_gets_nj_backfill(self, auth_client, owner):
        client = auth_client(owner)

        response = client.post(
            EMPLOYEES_URL, _new_employee_payload(date_of_joining="2026-04-15"), format="json"
        )

        assert response.status_code == 201, response.data
        employee = Employee.objects.get(employee_code="C-0065")
        backfilled = Attendance.objects.filter(employee=employee, year=2026, month=4)
        assert backfilled.count() == 14
        assert {r.day for r in backfilled} == set(range(1, 15))
        assert {r.status for r in backfilled} == {"NJ"}

    def test_duplicate_employee_code_conflicts(self, auth_client, owner):
        client = auth_client(owner)
        client.post(EMPLOYEES_URL, _new_employee_payload(), format="json")

        response = client.post(EMPLOYEES_URL, _new_employee_payload(), format="json")

        assert response.status_code == 409

    def test_delete_offboards_and_fills_rest_of_month(self, auth_client, owner):
        client = auth_client(owner)
        client.post(EMPLOYEES_URL, _new_employee_payload(), format="json")
        employee = Employee.objects.get(employee_code="C-0065")

        response = client.delete(f"{EMPLOYEES_URL}{employee.pk}/?date_of_leaving=2026-04-10")

        assert response.status_code == 200, response.data
        employee.refresh_from_db()
        assert employee.status == "Left"
        assert employee.date_of_leaving == date(2026, 4, 10)
        assert not employee.is_active
        # The employee row itself survives — history stays intact for audit.
        assert Employee.all_objects.filter(pk=employee.pk).exists()

        left_days = Attendance.objects.filter(employee=employee, year=2026, month=4, status="LEFT")
        assert {r.day for r in left_days} == set(range(11, 31))

    def test_offboarding_before_joining_is_rejected(self, auth_client, owner):
        client = auth_client(owner)
        client.post(EMPLOYEES_URL, _new_employee_payload(), format="json")
        employee = Employee.objects.get(employee_code="C-0065")

        response = client.delete(f"{EMPLOYEES_URL}{employee.pk}/?date_of_leaving=2026-03-01")

        # 422 is the platform's error contract for a domain validation failure
        # (shared.exceptions.ValidationError), not DRF's default 400.
        assert response.status_code == 422

    def test_face_embedding_is_never_exposed(self, auth_client, owner, employee_factory):
        employee_factory(face_embedding="[0.1, 0.2]")
        client = auth_client(owner)

        response = client.get(EMPLOYEES_URL)

        assert response.status_code == 200
        assert "face_embedding" not in response.data["data"][0]

    def test_anonymous_access_is_denied(self, api):
        assert api.get(EMPLOYEES_URL).status_code == 401


class TestAttendanceGrid:
    def test_present_day_without_swipes_gets_the_shift_window(
        self, auth_client, owner, employee_factory
    ):
        employee = employee_factory(doj=date(2026, 4, 1), shift="G")
        client = auth_client(owner)

        response = client.post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [{"employee_id": str(employee.pk), "days": [{"day": 1, "status": "P"}]}],
            },
            format="json",
        )

        assert response.status_code == 200, response.data
        row = Attendance.objects.get(employee=employee, year=2026, month=4, day=1)
        assert row.in_time == "09:00"
        assert row.out_time == "17:00"
        assert row.worked_hours == 8.0
        assert row.ot_hours == 0.0

    def test_night_shift_across_midnight_computes_ot(self, auth_client, owner, employee_factory):
        employee = employee_factory(doj=date(2026, 4, 1))
        client = auth_client(owner)

        response = client.post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [
                    {
                        "employee_id": str(employee.pk),
                        "days": [
                            {
                                "day": 2,
                                "status": "P",
                                "shift": "N",
                                "in_time": "22:00",
                                "out_time": "07:00",
                            }
                        ],
                    }
                ],
            },
            format="json",
        )

        assert response.status_code == 200, response.data
        row = Attendance.objects.get(employee=employee, year=2026, month=4, day=2)
        assert row.worked_hours == 9.0
        assert row.ot_hours == 1.0

    def test_blank_status_unmarks_the_day(self, auth_client, owner, employee_factory):
        employee = employee_factory(doj=date(2026, 4, 1))
        client = auth_client(owner)
        client.post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [{"employee_id": str(employee.pk), "days": [{"day": 3, "status": "P"}]}],
            },
            format="json",
        )
        assert Attendance.objects.filter(employee=employee, day=3).exists()

        client.post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [{"employee_id": str(employee.pk), "days": [{"day": 3, "status": ""}]}],
            },
            format="json",
        )

        # Hard-deleted, so the day can be re-entered later without tripping the
        # (employee, year, month, day) uniqueness constraint.
        assert not Attendance.all_objects.filter(employee=employee, day=3).exists()

    def test_grid_read_derives_late_and_early_flags(self, auth_client, owner, employee_factory):
        employee = employee_factory(doj=date(2026, 4, 1), shift="G")
        client = auth_client(owner)
        client.post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [
                    {
                        "employee_id": str(employee.pk),
                        "days": [
                            {
                                "day": 4,
                                "status": "P",
                                "in_time": "09:45",
                                "out_time": "16:00",
                            }
                        ],
                    }
                ],
            },
            format="json",
        )

        response = client.get(ATTENDANCE_URL, {"year": 2026, "month": 4})

        assert response.status_code == 200, response.data
        day = response.data["rows"][0]["days"]["4"]
        assert day["late_entry"] is True
        assert day["early_exit"] is True


class TestPayrollRun:
    def _mark_present(self, client, employee, days, **day_extra):
        return client.post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [
                    {
                        "employee_id": str(employee.pk),
                        "days": [{"day": d, "status": "P", **day_extra} for d in days],
                    }
                ],
            },
            format="json",
        )

    def test_full_month_payroll_matches_the_engine_formulas(
        self, auth_client, owner, employee_factory, salary_rule_factory, pay_rules
    ):
        employee = employee_factory(doj=date(2024, 1, 1))
        salary_rule_factory(employee=employee)
        client = auth_client(owner)
        self._mark_present(client, employee, range(1, 27))

        response = client.post(PAYROLL_RUN_URL, {"year": 2026, "month": 4}, format="json")

        assert response.status_code == 200, response.data
        row = Payroll.objects.get(employee=employee, year=2026, month=4)
        assert row.present_days == 26
        assert row.total_paid_days == 26
        # 26 present days out of a 26-day standard month = the full declared wage.
        assert row.basic_earned == 7500.0
        assert row.gross_salary == 15000.0
        # PF = ceil(12% of basic+da) = ceil(1350) capped at 1800
        assert row.pf_deduction == 1350.0
        # ESI = ceil(0.75% of 15000) = 113, under the 158 cap and the 21000 ceiling
        assert row.esi_deduction == 113.0
        assert row.net_salary == round(15000.0 - 1463.0, 2)

    def test_monthly_ot_is_the_sum_of_stored_daily_ot(
        self, auth_client, owner, employee_factory, salary_rule_factory, pay_rules
    ):
        employee = employee_factory(doj=date(2024, 1, 1))
        salary_rule_factory(employee=employee)
        client = auth_client(owner)
        # Three 10-hour days: 2h OT each.
        self._mark_present(client, employee, [1, 2, 3], in_time="09:00", out_time="19:00")

        client.post(PAYROLL_RUN_URL, {"year": 2026, "month": 4}, format="json")

        row = Payroll.objects.get(employee=employee, year=2026, month=4)
        assert row.ot_hours == 6.0
        # OT pay = 6 × (15000 / 26 / 8) × 2
        assert row.ot_earned == round(6 * (15000 / 26 / 8) * 2, 2)

    def test_employee_without_salary_rule_is_skipped(
        self, auth_client, owner, employee_factory, pay_rules
    ):
        employee = employee_factory(doj=date(2024, 1, 1))
        client = auth_client(owner)
        self._mark_present(client, employee, [1, 2])

        response = client.post(PAYROLL_RUN_URL, {"year": 2026, "month": 4}, format="json")

        assert response.status_code == 200
        assert not Payroll.objects.filter(employee=employee).exists()

    def test_rerunning_replaces_rather_than_duplicates(
        self, auth_client, owner, employee_factory, salary_rule_factory, pay_rules
    ):
        employee = employee_factory(doj=date(2024, 1, 1))
        salary_rule_factory(employee=employee)
        client = auth_client(owner)
        self._mark_present(client, employee, [1, 2])

        client.post(PAYROLL_RUN_URL, {"year": 2026, "month": 4}, format="json")
        self._mark_present(client, employee, [3, 4])
        client.post(PAYROLL_RUN_URL, {"year": 2026, "month": 4}, format="json")

        rows = Payroll.all_objects.filter(employee=employee, year=2026, month=4)
        assert rows.count() == 1
        assert rows.first().present_days == 4

    def test_month_summary_totals(
        self, auth_client, owner, employee_factory, salary_rule_factory, pay_rules
    ):
        first = employee_factory(code="C-0001", doj=date(2024, 1, 1))
        second = employee_factory(code="C-0002", doj=date(2024, 1, 1))
        salary_rule_factory(employee=first)
        salary_rule_factory(employee=second)
        client = auth_client(owner)
        for employee in (first, second):
            self._mark_present(client, employee, range(1, 27))
        client.post(PAYROLL_RUN_URL, {"year": 2026, "month": 4}, format="json")

        response = client.get(PAYROLL_URL, {"year": 2026, "month": 4})

        assert response.status_code == 200, response.data
        assert response.data["total_employees"] == 2
        assert response.data["total_gross"] == 30000.0
        # Names resolve through the relationship, never duplicated columns.
        assert {r["employee_code"] for r in response.data["records"]} == {"C-0001", "C-0002"}


class TestTenantIsolation:
    def test_another_tenants_employees_are_invisible(self, auth_client, owner, employee_factory):
        from tenancy.models import Tenant

        employee_factory(code="C-0001")
        other = Tenant.objects.create(name="Other Co", slug="other-co")
        Employee.objects.create(
            tenant=other,
            employee_code="X-0001",
            employee_name="Outsider",
            date_of_joining=date(2024, 1, 1),
        )

        response = auth_client(owner).get(EMPLOYEES_URL)

        assert response.status_code == 200
        codes = {row["employee_code"] for row in response.data["data"]}
        assert codes == {"C-0001"}


class TestLockedPeriod:
    """A locked month refuses edits — the migrated PeriodLock behaviour, now
    enforced by platform/periods rather than an HR-local table."""

    def _lock(self, tenant):
        from periods.services import PeriodService

        PeriodService().lock(tenant=tenant, year=2026, month=4)

    def test_attendance_save_is_blocked(self, auth_client, owner, tenant, employee_factory):
        employee = employee_factory(doj=date(2026, 4, 1))
        self._lock(tenant)

        response = auth_client(owner).post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [{"employee_id": str(employee.pk), "days": [{"day": 1, "status": "P"}]}],
            },
            format="json",
        )

        assert response.status_code == 409
        assert not Attendance.objects.filter(employee=employee, day=1).exists()

    def test_payroll_run_is_blocked(
        self, auth_client, owner, tenant, employee_factory, salary_rule_factory, pay_rules
    ):
        employee = employee_factory(doj=date(2024, 1, 1))
        salary_rule_factory(employee=employee)
        self._lock(tenant)

        response = auth_client(owner).post(
            PAYROLL_RUN_URL, {"year": 2026, "month": 4}, format="json"
        )

        assert response.status_code == 409
        assert not Payroll.objects.filter(employee=employee).exists()

    def test_unlocking_with_a_reason_restores_editing(
        self, auth_client, owner, tenant, employee_factory
    ):
        from periods.services import PeriodService

        employee = employee_factory(doj=date(2026, 4, 1))
        self._lock(tenant)
        PeriodService().unlock(tenant=tenant, year=2026, month=4, reason="Correction requested")

        response = auth_client(owner).post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [{"employee_id": str(employee.pk), "days": [{"day": 1, "status": "P"}]}],
            },
            format="json",
        )

        assert response.status_code == 200, response.data
        assert Attendance.objects.filter(employee=employee, day=1).exists()

    def test_a_different_month_is_still_editable(
        self, auth_client, owner, tenant, employee_factory
    ):
        employee = employee_factory(doj=date(2026, 4, 1))
        self._lock(tenant)

        response = auth_client(owner).post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 5,
                "records": [{"employee_id": str(employee.pk), "days": [{"day": 1, "status": "P"}]}],
            },
            format="json",
        )

        assert response.status_code == 200, response.data
