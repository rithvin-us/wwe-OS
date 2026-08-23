"""HR leave and expense pending items surface in the one platform Approval
Center, and deciding there routes back through the module services (so balances
and payroll effects are unchanged). Permission gating is enforced centrally.
"""

from __future__ import annotations

from datetime import date

import pytest
from approvals.services import ApprovalService
from shared import context
from shared.exceptions import PermissionDeniedError

from hr.backend.models import (
    ClaimStatus,
    ExpenseClaim,
    LeaveRequest,
    LeaveStatus,
    LeaveType,
)

pytestmark = pytest.mark.django_db


def _stranger(tenant):
    """A signed-in user with no HR permissions."""
    from users.models import User

    return User.objects.create_user(
        email="stranger@wwe.test",
        username="stranger",
        password="Str0ng!Pass1",
        tenant=tenant,
        status="active",
        is_email_verified=True,
    )


@pytest.fixture(autouse=True)
def _as_tenant(tenant):
    context.set_context(tenant=tenant, tenant_id=tenant.id)
    try:
        yield
    finally:
        context.clear_context()


@pytest.fixture
def leave_request(tenant, employee_factory):
    employee = employee_factory()
    leave_type = LeaveType.objects.create(tenant=tenant, code="CL", name="Casual Leave")
    return LeaveRequest.objects.create(
        tenant=tenant,
        employee=employee,
        leave_type=leave_type,
        start_date=date(2026, 8, 3),
        end_date=date(2026, 8, 3),
        days=1.0,
        status=LeaveStatus.PENDING,
    )


@pytest.fixture
def expense_claim(tenant, employee_factory):
    employee = employee_factory(code="C-0002")
    return ExpenseClaim.objects.create(
        tenant=tenant,
        employee=employee,
        expense_date=date(2026, 8, 1),
        amount=1250.0,
        status=ClaimStatus.PENDING,
    )


def test_pending_aggregates_leave_and_expense(owner, leave_request, expense_claim):
    pending = ApprovalService().pending(user=owner)

    kinds = {row["kind"] for row in pending}
    assert {"leave", "expense"} <= kinds
    ids = {row["object_id"] for row in pending}
    assert str(leave_request.pk) in ids
    assert str(expense_claim.pk) in ids


def test_pending_is_permission_filtered(tenant, leave_request):
    stranger = _stranger(tenant)

    assert ApprovalService().pending(user=stranger) == []


def test_approving_an_expense_routes_through_the_service(owner, expense_claim):
    ApprovalService().decide(
        user=owner, kind="expense", object_id=str(expense_claim.pk), approve=True
    )

    expense_claim.refresh_from_db()
    assert expense_claim.status == ClaimStatus.APPROVED


def test_rejecting_a_leave_request_requires_a_note(owner, leave_request):
    from shared.exceptions import ValidationError

    with pytest.raises(ValidationError):
        ApprovalService().decide(
            user=owner, kind="leave", object_id=str(leave_request.pk), approve=False, note=""
        )

    ApprovalService().decide(
        user=owner,
        kind="leave",
        object_id=str(leave_request.pk),
        approve=False,
        note="Insufficient cover",
    )
    leave_request.refresh_from_db()
    assert leave_request.status == LeaveStatus.REJECTED


def test_deciding_without_permission_is_forbidden(tenant, expense_claim):
    stranger = _stranger(tenant)

    with pytest.raises(PermissionDeniedError):
        ApprovalService().decide(
            user=stranger, kind="expense", object_id=str(expense_claim.pk), approve=True
        )
