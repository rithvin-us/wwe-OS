"""Onboarding checklists, expense reimbursement, analytics and policy chat.

The two hooks that were stubbed while their subsystems were still being migrated
are live here, so these tests exist mainly to prove they actually fire:
employee creation issues an onboarding checklist, and an approved expense claim
reaches net pay without touching gross.
"""

from __future__ import annotations

from datetime import date

import pytest

from hr.backend.models import EmployeeTask, Payroll, TaskTemplate

pytestmark = pytest.mark.django_db

EMPLOYEES_URL = "/api/v1/hr/employees/"
ATTENDANCE_URL = "/api/v1/hr/attendance/"
PAYROLL_RUN_URL = "/api/v1/hr/payroll/run/"
EXPENSES_URL = "/api/v1/hr/expenses/"
TASKS_URL = "/api/v1/hr/checklists/tasks/"
TEMPLATES_URL = "/api/v1/hr/checklists/templates/"
SUMMARY_URL = "/api/v1/hr/analytics/summary/"
TRENDS_URL = "/api/v1/hr/analytics/trends/"
ANOMALIES_URL = "/api/v1/hr/analytics/anomalies/"
CHAT_URL = "/api/v1/hr/policy-chat/"


def _employee_payload(**overrides) -> dict:
    payload = {
        "employee_code": "C-0100",
        "employee_name": "Anitha R",
        "date_of_joining": "2026-04-01",
        "salary": 15000,
        "pf_number": "PF-9",
        "uan": "UAN-9",
        "esic_number": "ESIC-9",
    }
    payload.update(overrides)
    return payload


class TestOnboardingHook:
    def test_creating_an_employee_issues_the_onboarding_checklist(self, auth_client, owner):
        response = auth_client(owner).post(EMPLOYEES_URL, _employee_payload(), format="json")

        assert response.status_code == 201, response.data
        tasks = EmployeeTask.objects.filter(employee_id=response.data["id"], workflow="onboarding")
        assert tasks.count() == 7
        titles = set(tasks.values_list("title", flat=True))
        assert "Setup Email Account" in titles
        assert "Enrol for Face Check-in" in titles
        # Due dates are anchored on the joining date.
        email_task = tasks.get(title="Setup Email Account")
        assert email_task.due_date == date(2026, 4, 2)  # +1 day

    def test_offboarding_issues_the_offboarding_checklist(self, auth_client, owner):
        client = auth_client(owner)
        created = client.post(EMPLOYEES_URL, _employee_payload(), format="json")

        client.delete(f"{EMPLOYEES_URL}{created.data['id']}/?date_of_leaving=2026-04-20")

        tasks = EmployeeTask.objects.filter(employee_id=created.data["id"], workflow="offboarding")
        assert tasks.count() == 5
        assert "Full & Final Settlement" in set(tasks.values_list("title", flat=True))
        # Anchored on the leaving date: +30 days for settlement.
        assert tasks.get(title="Full & Final Settlement").due_date == date(2026, 5, 20)

    def test_generation_is_idempotent(self, auth_client, owner, employee_factory):
        from hr.backend.services.onboarding import OnboardingService

        employee = employee_factory(doj=date(2026, 4, 1))
        service = OnboardingService()

        first = service.generate_for_employee(employee=employee, workflow="onboarding")
        second = service.generate_for_employee(employee=employee, workflow="onboarding")

        assert len(first) == 7
        assert second == []
        assert EmployeeTask.objects.filter(employee=employee).count() == 7

    def test_templates_are_seeded_once(self, auth_client, owner):
        client = auth_client(owner)
        client.get(TEMPLATES_URL)
        client.get(TEMPLATES_URL)

        assert TaskTemplate.objects.count() == 12  # 7 onboarding + 5 offboarding

    def test_a_task_can_be_completed_and_reopened(self, auth_client, owner):
        client = auth_client(owner)
        created = client.post(EMPLOYEES_URL, _employee_payload(), format="json")
        task = EmployeeTask.objects.filter(employee_id=created.data["id"]).first()

        done = client.post(f"{TASKS_URL}{task.pk}/complete/")
        assert done.status_code == 200, done.data
        assert done.data["status"] == "completed"
        assert done.data["completed_at"] is not None

        again = client.post(f"{TASKS_URL}{task.pk}/reopen/")
        assert again.status_code == 200
        assert again.data["status"] == "pending"
        assert again.data["completed_at"] is None


class TestExpenseReimbursement:
    def _submit(self, client, employee, amount=1200.0, when="2026-04-15"):
        return client.post(
            EXPENSES_URL,
            {
                "employee": str(employee.pk),
                "expense_date": when,
                "amount": amount,
                "category": "Travel",
                "description": "Site visit",
            },
            format="json",
        )

    def test_a_claim_starts_pending(self, auth_client, owner, employee_factory):
        employee = employee_factory(doj=date(2024, 1, 1))

        response = self._submit(auth_client(owner), employee)

        assert response.status_code == 201, response.data
        assert response.data["status"] == "pending"
        assert response.data["has_receipt"] is False

    def test_a_pending_claim_is_not_reimbursed(
        self, auth_client, owner, employee_factory, salary_rule_factory, pay_rules
    ):
        employee = employee_factory(doj=date(2024, 1, 1))
        salary_rule_factory(employee=employee)
        client = auth_client(owner)
        self._submit(client, employee)
        self._mark_full_month(client, employee)

        client.post(PAYROLL_RUN_URL, {"year": 2026, "month": 4}, format="json")

        row = Payroll.objects.get(employee=employee, year=2026, month=4)
        assert row.expense_reimbursement == 0.0

    def test_an_approved_claim_reaches_net_but_never_gross(
        self, auth_client, owner, employee_factory, salary_rule_factory, pay_rules
    ):
        employee = employee_factory(doj=date(2024, 1, 1))
        salary_rule_factory(employee=employee)
        client = auth_client(owner)
        claim = self._submit(client, employee, amount=1200.0)
        client.post(
            f"{EXPENSES_URL}{claim.data['id']}/decide/", {"status": "approved"}, format="json"
        )
        self._mark_full_month(client, employee)

        client.post(PAYROLL_RUN_URL, {"year": 2026, "month": 4}, format="json")

        row = Payroll.objects.get(employee=employee, year=2026, month=4)
        assert row.expense_reimbursement == 1200.0
        # Gross is untouched, so the PF and ESI bases are untouched too.
        assert row.gross_salary == 15000.0
        assert row.pf_deduction == 1350.0
        assert row.esi_deduction == 113.0
        # Net = gross - deductions + reimbursement.
        assert row.net_salary == round(15000.0 - 1463.0 + 1200.0, 2)

    def test_a_claim_from_another_month_is_not_reimbursed(
        self, auth_client, owner, employee_factory, salary_rule_factory, pay_rules
    ):
        employee = employee_factory(doj=date(2024, 1, 1))
        salary_rule_factory(employee=employee)
        client = auth_client(owner)
        claim = self._submit(client, employee, when="2026-03-15")
        client.post(
            f"{EXPENSES_URL}{claim.data['id']}/decide/", {"status": "approved"}, format="json"
        )
        self._mark_full_month(client, employee)

        client.post(PAYROLL_RUN_URL, {"year": 2026, "month": 4}, format="json")

        row = Payroll.objects.get(employee=employee, year=2026, month=4)
        assert row.expense_reimbursement == 0.0

    def test_a_decided_claim_cannot_be_decided_again(self, auth_client, owner, employee_factory):
        employee = employee_factory(doj=date(2024, 1, 1))
        client = auth_client(owner)
        claim = self._submit(client, employee)
        client.post(
            f"{EXPENSES_URL}{claim.data['id']}/decide/", {"status": "approved"}, format="json"
        )

        response = client.post(
            f"{EXPENSES_URL}{claim.data['id']}/decide/", {"status": "rejected"}, format="json"
        )

        assert response.status_code == 409

    def _mark_full_month(self, client, employee):
        client.post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [
                    {
                        "employee_id": str(employee.pk),
                        "days": [{"day": d, "status": "P"} for d in range(1, 27)],
                    }
                ],
            },
            format="json",
        )


class TestAnalytics:
    def test_summary_reports_headcount_and_attendance(self, auth_client, owner, employee_factory):
        present = employee_factory(code="C-0001", doj=date(2024, 1, 1))
        employee_factory(code="C-0002", doj=date(2024, 1, 1))
        client = auth_client(owner)
        client.post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [
                    {
                        "employee_id": str(present.pk),
                        "days": [
                            {"day": 1, "status": "P"},
                            {"day": 2, "status": "P"},
                            {"day": 3, "status": "A"},
                        ],
                    }
                ],
            },
            format="json",
        )

        response = client.get(SUMMARY_URL, {"year": 2026, "month": 4})

        assert response.status_code == 200, response.data
        assert response.data["total_employees"] == 2
        assert response.data["active_employees"] == 2
        assert response.data["present_units"] == 2.0
        assert response.data["absent_days"] == 1
        assert response.data["working_units"] == 3.0
        # 2 present of 3 scheduled.
        assert response.data["attendance_pct"] == 66.7
        assert response.data["period_locked"] is False

    def test_half_days_count_as_half_a_unit(self, auth_client, owner, employee_factory):
        employee = employee_factory(doj=date(2024, 1, 1))
        client = auth_client(owner)
        client.post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [
                    {
                        "employee_id": str(employee.pk),
                        "days": [{"day": 1, "status": "P"}, {"day": 2, "status": "HD"}],
                    }
                ],
            },
            format="json",
        )

        response = client.get(SUMMARY_URL, {"year": 2026, "month": 4})

        assert response.data["present_units"] == 1.5

    def test_compliance_counts_missing_statutory_numbers(
        self, auth_client, owner, employee_factory
    ):
        employee_factory(code="C-0001", pf_number="", uan="", esic_number="")
        employee_factory(code="C-0002")

        response = auth_client(owner).get(SUMMARY_URL, {"year": 2026, "month": 4})

        compliance = response.data["compliance"]
        assert compliance["missing_pf"] == 1
        assert compliance["missing_uan"] == 1
        assert compliance["missing_esic"] == 1
        assert compliance["compliant_pct"] == 50.0

    def test_trends_returns_one_point_per_month_newest_last(self, auth_client, owner):
        response = auth_client(owner).get(TRENDS_URL, {"year": 2026, "month": 4, "months": 3})

        assert response.status_code == 200
        labels = [p["label"] for p in response.data["points"]]
        assert labels == ["Feb 2026", "Mar 2026", "Apr 2026"]

    def test_anomalies_flag_an_incomplete_punch_pair(self, auth_client, owner, employee_factory):
        employee = employee_factory(doj=date(2024, 1, 1))
        client = auth_client(owner)
        client.post(
            ATTENDANCE_URL,
            {
                "year": 2026,
                "month": 4,
                "records": [
                    {
                        "employee_id": str(employee.pk),
                        "days": [{"day": 1, "status": "P", "in_time": "09:00"}],
                    }
                ],
            },
            format="json",
        )

        response = client.get(ANOMALIES_URL, {"year": 2026, "month": 4})

        assert response.status_code == 200, response.data
        assert response.data["by_type"].get("MISSING_PUNCH") == 1

    def test_anomalies_flag_an_employee_with_no_attendance(
        self, auth_client, owner, employee_factory
    ):
        employee_factory(code="C-0009", doj=date(2024, 1, 1))

        response = auth_client(owner).get(ANOMALIES_URL, {"year": 2026, "month": 4})

        assert response.data["by_type"].get("MISSING_ATTENDANCE") == 1


class TestPolicyChat:
    def test_it_answers_from_the_policy_document(self, auth_client, owner):
        response = auth_client(owner).post(
            CHAT_URL, {"question": "How much leave do I get?"}, format="json"
        )

        assert response.status_code == 200, response.data
        assert response.data["answer"]
        assert isinstance(response.data["sources"], list)

    def test_an_unanswerable_question_says_so_rather_than_inventing(self, auth_client, owner):
        response = auth_client(owner).post(
            CHAT_URL, {"question": "zzzqqq xyzzy plugh"}, format="json"
        )

        assert response.status_code == 200
        assert "couldn't find" in response.data["answer"]
        assert response.data["sources"] == []

    def test_it_requires_authentication(self, api):
        assert api.post(CHAT_URL, {"question": "leave?"}, format="json").status_code == 401
