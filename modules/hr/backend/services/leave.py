"""Leave balances and decisions.

Migrated from the legacy app's `leave_service` plus the decision half of its
leaves API. The rules are unchanged:

- A request's day count is the **inclusive** calendar span, computed once at
  creation.
- A balance row is materialised on demand from the leave type's default annual
  quota, so an employee never has to be pre-provisioned.
- Approval deducts from the balance for the year of the request's *start* date,
  and is refused if the remaining balance cannot cover it.
- Only a pending request can be decided or withdrawn.

Approvals notify through `platform/notifications` rather than a bespoke inbox —
the single-operator design puts everything needing attention in one place.
"""

from __future__ import annotations

import logging
from datetime import date

from audit.services import AuditService
from django.db import transaction
from django.utils import timezone
from shared import context
from shared.exceptions import ConflictError, ValidationError

from hr.backend.models import LeaveBalance, LeaveRequest, LeaveStatus, LeaveType

logger = logging.getLogger(__name__)

MODULE = "hr"

# Seeded on first use; edit through the leave-type endpoints afterwards.
DEFAULT_LEAVE_TYPES = [
    {
        "name": "Sick Leave",
        "code": "SL",
        "default_annual_quota": 12,
        "is_paid": True,
        "description": "Illness or medical appointments.",
    },
    {
        "name": "Casual Leave",
        "code": "CL",
        "default_annual_quota": 12,
        "is_paid": True,
        "description": "Personal matters and emergencies.",
    },
    {
        "name": "Annual Leave",
        "code": "AL",
        "default_annual_quota": 15,
        "is_paid": True,
        "description": "Planned vacation / privilege leave.",
    },
]


def calculate_leave_days(start_date: date, end_date: date) -> float:
    """Inclusive calendar days between start and end."""
    return float((end_date - start_date).days + 1)


class LeaveService:
    def __init__(self) -> None:
        self.audit = AuditService()

    def seed_default_types(self, tenant=None) -> int:
        """Insert the standard leave types if this tenant has none. Idempotent."""
        tenant = tenant or context.current_tenant()
        if LeaveType.objects.filter(tenant=tenant).exists():
            return 0
        LeaveType.objects.bulk_create(
            [LeaveType(tenant=tenant, **definition) for definition in DEFAULT_LEAVE_TYPES]
        )
        logger.info("Seeded %d default leave types", len(DEFAULT_LEAVE_TYPES))
        return len(DEFAULT_LEAVE_TYPES)

    def get_or_create_balance(self, *, employee, leave_type, year: int) -> LeaveBalance:
        """Fetch the balance row, creating it from the type's default quota."""
        balance, _created = LeaveBalance.objects.get_or_create(
            employee=employee,
            leave_type=leave_type,
            year=year,
            defaults={
                "tenant_id": employee.tenant_id,
                "allocated": leave_type.default_annual_quota,
                "used": 0.0,
            },
        )
        return balance

    def balances_for(self, *, employee, year: int):
        """Every leave type's balance for one employee, materialising missing
        rows so the screen always shows the full picture."""
        self.seed_default_types(tenant=employee.tenant)
        for leave_type in LeaveType.objects.filter(tenant_id=employee.tenant_id):
            self.get_or_create_balance(employee=employee, leave_type=leave_type, year=year)
        return (
            LeaveBalance.objects.filter(employee=employee, year=year)
            .select_related("employee", "leave_type")
            .order_by("leave_type__code")
        )

    @transaction.atomic
    def request_leave(self, *, employee, leave_type, data: dict) -> LeaveRequest:
        start_date = data["start_date"]
        end_date = data["end_date"]
        if end_date < start_date:
            raise ValidationError(detail={"end_date": ["End date cannot be before start date."]})

        request = LeaveRequest.objects.create(
            tenant_id=employee.tenant_id,
            employee=employee,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            days=calculate_leave_days(start_date, end_date),
            reason=data.get("reason", ""),
        )

        self.audit.record(
            action="hr.leave.requested",
            module=MODULE,
            object_type="LeaveRequest",
            object_id=str(request.pk),
            changes={
                "employee_code": employee.employee_code,
                "leave_type": leave_type.code,
                "from": str(start_date),
                "to": str(end_date),
                "days": request.days,
            },
        )
        return request

    @transaction.atomic
    def decide(self, *, request: LeaveRequest, status: str, note: str = "", actor=None):
        """Approve or reject a pending request.

        Approval deducts the days from the balance for the year of the start
        date, and is refused outright if the remaining balance cannot cover it —
        the approver sees why rather than silently over-drawing.
        """
        if status not in (LeaveStatus.APPROVED, LeaveStatus.REJECTED):
            raise ValidationError(
                detail={"status": ["A decision must be either approved or rejected."]}
            )
        if request.status != LeaveStatus.PENDING:
            raise ConflictError(f"Request is already {request.status}.")

        if status == LeaveStatus.APPROVED:
            balance = self.get_or_create_balance(
                employee=request.employee,
                leave_type=request.leave_type,
                year=request.start_date.year,
            )
            if balance.remaining < request.days:
                raise ValidationError(
                    detail={
                        "days": [
                            f"Insufficient balance: {balance.remaining:g} day(s) remaining, "
                            f"request needs {request.days:g}."
                        ]
                    }
                )
            balance.used += request.days
            balance.save(update_fields=["used", "updated_at"])

        request.status = status
        request.decided_by = actor or context.current_user()
        request.decided_at = timezone.now()
        request.decision_note = note or ""
        request.save(
            update_fields=["status", "decided_by", "decided_at", "decision_note", "updated_at"]
        )

        self.audit.record(
            action=f"hr.leave.{status}",
            module=MODULE,
            object_type="LeaveRequest",
            object_id=str(request.pk),
            changes={"days": request.days, "note": request.decision_note},
        )
        return request

    @transaction.atomic
    def withdraw(self, *, request: LeaveRequest) -> None:
        """Withdraw a request. Only a pending one can be withdrawn — a decided
        request is part of the leave record."""
        if request.status != LeaveStatus.PENDING:
            raise ConflictError("Only a pending request can be withdrawn.")

        request_id = str(request.pk)
        request.delete()
        self.audit.record(
            action="hr.leave.withdrawn",
            module=MODULE,
            object_type="LeaveRequest",
            object_id=request_id,
        )
