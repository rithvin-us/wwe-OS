"""Expense claims.

Migrated from the legacy app's expenses API. Behaviour preserved: a claim is
raised as pending, and only an approved claim dated inside a month is reimbursed
with that month's salary — after deductions, never into gross, so the PF/ESI
bases are untouched (`payroll_engine._expense_reimbursement`).

The receipt goes to `platform/storage` instead of a locally served uploads
directory, so it gets durable storage, a SHA-256, a signed URL and integrity
verification for free.
"""

from __future__ import annotations

from audit.services import AuditService
from django.db import transaction
from django.utils import timezone
from shared import context
from shared.exceptions import ConflictError, ValidationError
from storage.services import StorageService

from hr.backend.models import ClaimStatus, ExpenseClaim

MODULE = "hr"
RECEIPT_CATEGORY = "expense_receipt"


class ExpenseService:
    def __init__(self) -> None:
        self.storage = StorageService()
        self.audit = AuditService()

    @transaction.atomic
    def submit(self, *, employee, data: dict, receipt=None) -> ExpenseClaim:
        stored = None
        if receipt is not None:
            stored = self.storage.store(
                data=receipt.read(),
                filename=getattr(receipt, "name", "receipt"),
                content_type=getattr(receipt, "content_type", "") or "application/octet-stream",
                module=MODULE,
                tenant=employee.tenant,
                uploaded_by=context.current_user(),
                category=RECEIPT_CATEGORY,
                period_year=data["expense_date"].year,
                period_month=data["expense_date"].month,
            )

        claim = ExpenseClaim.objects.create(
            tenant_id=employee.tenant_id,
            employee=employee,
            expense_date=data["expense_date"],
            amount=data["amount"],
            category=data.get("category") or "Other",
            description=data.get("description", ""),
            receipt=stored,
        )

        self.audit.record(
            action="hr.expense.submitted",
            module=MODULE,
            object_type="ExpenseClaim",
            object_id=str(claim.pk),
            changes={
                "employee_code": employee.employee_code,
                "amount": claim.amount,
                "category": claim.category,
                "expense_date": str(claim.expense_date),
            },
        )
        return claim

    @transaction.atomic
    def decide(self, *, claim: ExpenseClaim, status: str, note: str = "", actor=None):
        """Approve or reject a pending claim.

        An approved claim changes what the employee is paid, so it can only be
        decided once — reversing it means a new claim, not an edited decision.
        """
        if status not in (ClaimStatus.APPROVED, ClaimStatus.REJECTED):
            raise ValidationError(
                detail={"status": ["A decision must be either approved or rejected."]}
            )
        if claim.status != ClaimStatus.PENDING:
            raise ConflictError(f"Claim is already {claim.status}.")

        claim.status = status
        claim.decided_by = actor or context.current_user()
        claim.decided_at = timezone.now()
        claim.decision_note = note or ""
        claim.save(
            update_fields=["status", "decided_by", "decided_at", "decision_note", "updated_at"]
        )

        self.audit.record(
            action=f"hr.expense.{status}",
            module=MODULE,
            object_type="ExpenseClaim",
            object_id=str(claim.pk),
            changes={"amount": claim.amount, "note": claim.decision_note},
        )
        return claim

    def receipt_url(self, claim: ExpenseClaim) -> str | None:
        """Time-limited download link for the receipt, or None if there isn't one."""
        if claim.receipt is None:
            return None
        return self.storage.signed_url(claim.receipt)
