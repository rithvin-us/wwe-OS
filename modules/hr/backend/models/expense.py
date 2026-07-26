"""Expense claims and tax declarations.

Migrated from the legacy app's expense models.

- `ExpenseClaim` — a reimbursement claim with a receipt and a
  pending/approved/rejected decision. Claims approved for a month are added to
  that month's **net** salary as a non-taxable reimbursement; they never enter
  gross, so the PF/ESI bases are unaffected (see `payroll_engine`).
- `TaxDeclaration` — investment / tax-saving declarations per Indian financial
  year (80C, 80D, HRA …).

The receipt itself goes to `platform/storage` rather than a served URL on local
disk as the legacy app did — the platform owns file storage, signed URLs and
integrity checking.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class ClaimStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class ExpenseCategory(models.TextChoices):
    TRAVEL = "Travel", "Travel"
    FOOD = "Food", "Food"
    ACCOMMODATION = "Accommodation", "Accommodation"
    OFFICE_SUPPLIES = "Office Supplies", "Office supplies"
    MEDICAL = "Medical", "Medical"
    OTHER = "Other", "Other"


class ExpenseClaim(TenantOwnedModel):
    employee = models.ForeignKey(
        "hr.Employee", on_delete=models.CASCADE, related_name="expense_claims"
    )
    expense_date = models.DateField()
    amount = models.FloatField(default=0.0)
    category = models.CharField(
        max_length=30, choices=ExpenseCategory.choices, default=ExpenseCategory.OTHER
    )
    description = models.TextField(blank=True)

    # The receipt lives in platform storage; this points at it. Legacy stored a
    # URL into a locally served uploads directory.
    receipt = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_expense_claims",
    )

    status = models.CharField(
        max_length=20, choices=ClaimStatus.choices, default=ClaimStatus.PENDING, db_index=True
    )
    decided_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_expense_decisions",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_expense_claim"
        indexes = [
            models.Index(fields=["employee", "expense_date"]),
            models.Index(fields=["tenant", "status"]),
        ]

    def __str__(self) -> str:
        return f"claim({self.employee_id}, {self.amount}, {self.status})"


class TaxDeclaration(TenantOwnedModel):
    employee = models.ForeignKey(
        "hr.Employee", on_delete=models.CASCADE, related_name="tax_declarations"
    )
    # Indian financial year label, e.g. "2026-27".
    financial_year = models.CharField(max_length=10)
    # Section the declaration falls under (80C, 80D, HRA …).
    section = models.CharField(max_length=20)
    description = models.TextField(blank=True)
    declared_amount = models.FloatField(default=0.0)
    proof = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_tax_declarations",
    )
    status = models.CharField(
        max_length=20, choices=ClaimStatus.choices, default=ClaimStatus.PENDING
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_tax_declaration"
        indexes = [models.Index(fields=["employee", "financial_year"])]

    def __str__(self) -> str:
        return f"{self.employee_id} {self.financial_year} {self.section}"
