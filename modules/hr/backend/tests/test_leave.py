"""The migrated leave engine.

Asserts the legacy rules: inclusive day counts, balances materialised from the
type's default quota, approval refused when the balance cannot cover it, and
only pending requests being decidable or withdrawable.
"""

from __future__ import annotations

from datetime import date

import pytest

from hr.backend.models import LeaveBalance, LeaveRequest, LeaveType
from hr.backend.services.leave import calculate_leave_days

pytestmark = pytest.mark.django_db

TYPES_URL = "/api/v1/hr/leave/types/"
BALANCES_URL = "/api/v1/hr/leave/balances/"
REQUESTS_URL = "/api/v1/hr/leave/requests/"


@pytest.fixture
def leave_setup(auth_client, owner, employee_factory):
    employee = employee_factory(doj=date(2024, 1, 1))
    client = auth_client(owner)
    client.get(TYPES_URL)  # seeds the standard types
    casual = LeaveType.objects.get(code="CL")
    return client, employee, casual


def _request_payload(employee, leave_type, start, end, reason="Family function"):
    return {
        "employee": str(employee.pk),
        "leave_type": str(leave_type.pk),
        "start_date": start,
        "end_date": end,
        "reason": reason,
    }


class TestDayCount:
    def test_a_single_day_counts_as_one(self):
        assert calculate_leave_days(date(2026, 4, 10), date(2026, 4, 10)) == 1.0

    def test_the_span_is_inclusive_of_both_ends(self):
        assert calculate_leave_days(date(2026, 4, 10), date(2026, 4, 12)) == 3.0


class TestLeaveTypes:
    def test_standard_types_are_seeded_on_first_read(self, auth_client, owner):
        response = auth_client(owner).get(TYPES_URL)

        assert response.status_code == 200
        codes = {row["code"] for row in response.data["data"]}
        assert codes == {"SL", "CL", "AL"}

    def test_seeding_is_idempotent(self, auth_client, owner):
        client = auth_client(owner)
        client.get(TYPES_URL)
        client.get(TYPES_URL)

        assert LeaveType.objects.count() == 3


class TestBalances:
    def test_balances_are_materialised_for_every_type(self, leave_setup):
        client, employee, _ = leave_setup

        response = client.get(BALANCES_URL, {"employee": str(employee.pk), "year": 2026})

        assert response.status_code == 200, response.data
        assert len(response.data) == 3
        casual = next(row for row in response.data if row["leave_type_code"] == "CL")
        # Allocated comes from the type's default annual quota.
        assert casual["allocated"] == 12.0
        assert casual["used"] == 0.0
        assert casual["remaining"] == 12.0

    def test_remaining_is_derived_not_stored(self, leave_setup):
        client, employee, casual = leave_setup
        client.get(BALANCES_URL, {"employee": str(employee.pk), "year": 2026})
        balance = LeaveBalance.objects.get(employee=employee, leave_type=casual, year=2026)

        balance.used = 5.0
        balance.save()

        assert balance.remaining == 7.0
        assert "remaining" not in {f.name for f in LeaveBalance._meta.get_fields()}


class TestRequestAndDecide:
    def test_request_computes_its_own_day_count(self, leave_setup):
        client, employee, casual = leave_setup

        response = client.post(
            REQUESTS_URL,
            _request_payload(employee, casual, "2026-04-10", "2026-04-12"),
            format="json",
        )

        assert response.status_code == 201, response.data
        assert response.data["days"] == 3.0
        assert response.data["status"] == "pending"

    def test_client_cannot_dictate_the_day_count(self, leave_setup):
        client, employee, casual = leave_setup
        payload = _request_payload(employee, casual, "2026-04-10", "2026-04-12")
        payload["days"] = 99

        response = client.post(REQUESTS_URL, payload, format="json")

        assert response.status_code == 201
        assert response.data["days"] == 3.0

    def test_end_before_start_is_rejected(self, leave_setup):
        client, employee, casual = leave_setup

        response = client.post(
            REQUESTS_URL,
            _request_payload(employee, casual, "2026-04-12", "2026-04-10"),
            format="json",
        )

        assert response.status_code == 422

    def test_approval_deducts_from_the_balance(self, leave_setup):
        client, employee, casual = leave_setup
        created = client.post(
            REQUESTS_URL,
            _request_payload(employee, casual, "2026-04-10", "2026-04-12"),
            format="json",
        )

        response = client.post(
            f"{REQUESTS_URL}{created.data['id']}/decide/",
            {"status": "approved", "decision_note": "Approved"},
            format="json",
        )

        assert response.status_code == 200, response.data
        assert response.data["status"] == "approved"
        assert response.data["decided_at"] is not None
        balance = LeaveBalance.objects.get(employee=employee, leave_type=casual, year=2026)
        assert balance.used == 3.0
        assert balance.remaining == 9.0

    def test_rejection_does_not_touch_the_balance(self, leave_setup):
        client, employee, casual = leave_setup
        created = client.post(
            REQUESTS_URL,
            _request_payload(employee, casual, "2026-04-10", "2026-04-12"),
            format="json",
        )

        response = client.post(
            f"{REQUESTS_URL}{created.data['id']}/decide/",
            {"status": "rejected", "decision_note": "Peak season"},
            format="json",
        )

        assert response.status_code == 200
        balance = LeaveBalance.objects.filter(
            employee=employee, leave_type=casual, year=2026
        ).first()
        assert balance is None or balance.used == 0.0

    def test_approval_is_refused_when_the_balance_cannot_cover_it(self, leave_setup):
        client, employee, casual = leave_setup
        # CL quota is 12 days; ask for 20.
        created = client.post(
            REQUESTS_URL,
            _request_payload(employee, casual, "2026-04-01", "2026-04-20"),
            format="json",
        )
        assert created.data["days"] == 20.0

        response = client.post(
            f"{REQUESTS_URL}{created.data['id']}/decide/", {"status": "approved"}, format="json"
        )

        assert response.status_code == 422
        # Nothing half-applied — the whole decision rolls back, including the
        # balance row the check materialised on its way in.
        assert LeaveRequest.objects.get(pk=created.data["id"]).status == "pending"
        balance = LeaveBalance.objects.filter(
            employee=employee, leave_type=casual, year=2026
        ).first()
        assert balance is None or balance.used == 0.0

    def test_a_decided_request_cannot_be_decided_again(self, leave_setup):
        client, employee, casual = leave_setup
        created = client.post(
            REQUESTS_URL,
            _request_payload(employee, casual, "2026-04-10", "2026-04-11"),
            format="json",
        )
        client.post(
            f"{REQUESTS_URL}{created.data['id']}/decide/", {"status": "approved"}, format="json"
        )

        response = client.post(
            f"{REQUESTS_URL}{created.data['id']}/decide/", {"status": "rejected"}, format="json"
        )

        assert response.status_code == 409

    def test_only_a_pending_request_can_be_withdrawn(self, leave_setup):
        client, employee, casual = leave_setup
        pending = client.post(
            REQUESTS_URL,
            _request_payload(employee, casual, "2026-04-10", "2026-04-11"),
            format="json",
        )
        decided = client.post(
            REQUESTS_URL,
            _request_payload(employee, casual, "2026-05-10", "2026-05-11"),
            format="json",
        )
        client.post(
            f"{REQUESTS_URL}{decided.data['id']}/decide/", {"status": "approved"}, format="json"
        )

        assert client.delete(f"{REQUESTS_URL}{pending.data['id']}/").status_code == 204
        assert client.delete(f"{REQUESTS_URL}{decided.data['id']}/").status_code == 409

    def test_balance_year_follows_the_start_date(self, leave_setup):
        client, employee, casual = leave_setup
        # Spans the new year: charged to the year the leave starts in.
        created = client.post(
            REQUESTS_URL,
            _request_payload(employee, casual, "2026-12-30", "2027-01-02"),
            format="json",
        )
        client.post(
            f"{REQUESTS_URL}{created.data['id']}/decide/", {"status": "approved"}, format="json"
        )

        assert LeaveBalance.objects.get(employee=employee, year=2026).used == 4.0
        assert not LeaveBalance.objects.filter(employee=employee, year=2027).exists()
