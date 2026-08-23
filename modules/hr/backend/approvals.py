"""HR's approval sources: pending leave requests and pending expense claims.

Registers both with the platform Approval Center so they land in the one inbox.
The centre owns aggregation and permission enforcement; deciding routes back
through the existing `LeaveService` / `ExpenseService` — no decision logic is
duplicated here, so balances and payroll effects stay exactly as they were.
"""

from __future__ import annotations

from collections.abc import Iterable

from approvals.registry import Approval, ApprovalSource, register

from hr.backend.models import ClaimStatus, ExpenseClaim, LeaveRequest, LeaveStatus


# --------------------------------------------------------------------------- #
# Leave
# --------------------------------------------------------------------------- #
def _leave_pending(tenant) -> Iterable[Approval]:
    qs = LeaveRequest.objects.filter(status=LeaveStatus.PENDING).select_related(
        "employee", "leave_type"
    )
    if tenant is not None:
        qs = qs.filter(tenant=tenant)
    for req in qs.order_by("created_at"):
        yield Approval(
            kind="leave",
            object_id=str(req.pk),
            title=f"{req.leave_type.name} · {req.days:g} day(s)",
            requester=req.employee.employee_name,
            submitted_at=req.created_at,
            priority="normal",
            current_step="Awaiting approval",
            url="/hr/leave",
            extra={"start_date": str(req.start_date), "end_date": str(req.end_date)},
        )


def _leave_decide(object_id: str, *, approve: bool, actor, note: str = "") -> None:
    from hr.backend.services.leave import LeaveService

    req = LeaveRequest.objects.get(pk=object_id)
    LeaveService().decide(
        request=req,
        status=LeaveStatus.APPROVED if approve else LeaveStatus.REJECTED,
        note=note,
        actor=actor,
    )


# --------------------------------------------------------------------------- #
# Expenses
# --------------------------------------------------------------------------- #
def _expense_pending(tenant) -> Iterable[Approval]:
    qs = ExpenseClaim.objects.filter(status=ClaimStatus.PENDING).select_related("employee")
    if tenant is not None:
        qs = qs.filter(tenant=tenant)
    for claim in qs.order_by("created_at"):
        yield Approval(
            kind="expense",
            object_id=str(claim.pk),
            title=f"{claim.get_category_display()} · {claim.amount:.2f}",
            requester=claim.employee.employee_name,
            submitted_at=claim.created_at,
            priority="normal",
            current_step="Awaiting approval",
            url="/hr/expenses",
            extra={"amount": claim.amount, "expense_date": str(claim.expense_date)},
        )


def _expense_decide(object_id: str, *, approve: bool, actor, note: str = "") -> None:
    from hr.backend.services.expense import ExpenseService

    claim = ExpenseClaim.objects.get(pk=object_id)
    ExpenseService().decide(
        claim=claim,
        status=ClaimStatus.APPROVED if approve else ClaimStatus.REJECTED,
        note=note,
        actor=actor,
    )


def register_approvals() -> None:
    register(
        ApprovalSource(
            kind="leave",
            label="Leave",
            view_permission="hr.leave.read",
            decide_permission="hr.leave.manage",
            pending=_leave_pending,
            decide=_leave_decide,
        )
    )
    register(
        ApprovalSource(
            kind="expense",
            label="Expense",
            view_permission="hr.expense.read",
            decide_permission="hr.expense.manage",
            pending=_expense_pending,
            decide=_expense_decide,
        )
    )
