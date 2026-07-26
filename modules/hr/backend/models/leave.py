"""Leave & time-off.

Migrated from the legacy app's leave models.

- `LeaveType` — the catalogue of leave kinds with the default yearly quota used
  when a balance row is first materialised.
- `LeaveBalance` — per employee, per type, per calendar year. Stores allocated
  and used; remaining is computed so the two can never disagree.
- `LeaveRequest` — a dated request with a pending → approved/rejected decision.
  Approval deducts from the matching balance (`hr.backend.services.leave`).
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class LeaveStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class LeaveType(TenantOwnedModel):
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=10)
    default_annual_quota = models.FloatField(default=0.0)
    is_paid = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_leave_type"
        ordering = ("code",)
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "code"], name="uniq_leave_type_code_per_tenant"
            ),
            models.UniqueConstraint(
                fields=["tenant", "name"], name="uniq_leave_type_name_per_tenant"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code} · {self.name}"


class LeaveBalance(TenantOwnedModel):
    employee = models.ForeignKey(
        "hr.Employee", on_delete=models.CASCADE, related_name="leave_balances"
    )
    leave_type = models.ForeignKey(
        "hr.LeaveType", on_delete=models.CASCADE, related_name="balances"
    )
    year = models.PositiveIntegerField()
    allocated = models.FloatField(default=0.0)
    used = models.FloatField(default=0.0)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_leave_balance"
        ordering = ("leave_type__code",)
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "employee", "leave_type", "year"],
                name="uniq_leave_balance_per_year",
            ),
        ]
        indexes = [models.Index(fields=["employee", "year"])]

    def __str__(self) -> str:
        return f"{self.employee_id} {self.leave_type_id} {self.used}/{self.allocated}"

    @property
    def remaining(self) -> float:
        return max(0.0, self.allocated - self.used)


class LeaveRequest(TenantOwnedModel):
    employee = models.ForeignKey(
        "hr.Employee", on_delete=models.CASCADE, related_name="leave_requests"
    )
    leave_type = models.ForeignKey(
        "hr.LeaveType", on_delete=models.CASCADE, related_name="requests"
    )
    start_date = models.DateField()
    end_date = models.DateField()
    # Inclusive calendar days between start and end, computed at creation.
    days = models.FloatField(default=1.0)
    reason = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=LeaveStatus.choices, default=LeaveStatus.PENDING, db_index=True
    )

    decided_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_leave_decisions",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_leave_request"
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["employee", "start_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee_id} {self.start_date}..{self.end_date} [{self.status}]"
