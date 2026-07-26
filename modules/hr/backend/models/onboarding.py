"""Onboarding / offboarding checklists.

Migrated from the legacy app's workflow models.

- `TaskTemplate` — reusable checklist items ("Setup Email", "Collect Assets")
  tagged as onboarding or offboarding, seeded with sensible defaults.
- `EmployeeTask` — a template instantiated for one employee. Auto-generated when
  an employee is created (onboarding) or marked Left (offboarding).

The task carries its own title/description/department rather than reading them
through the template, so deleting or editing a template never rewrites history
on checklists already issued.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class WorkflowType(models.TextChoices):
    ONBOARDING = "onboarding", "Onboarding"
    OFFBOARDING = "offboarding", "Offboarding"


class TaskStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    COMPLETED = "completed", "Completed"


class TaskTemplate(TenantOwnedModel):
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    # Department responsible (IT, HR, Admin, Finance …).
    department = models.CharField(max_length=50, blank=True)
    workflow = models.CharField(
        max_length=20, choices=WorkflowType.choices, default=WorkflowType.ONBOARDING
    )
    # Due this many days after joining (onboarding) or leaving (offboarding).
    default_due_days = models.IntegerField(default=7)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_task_template"
        ordering = ("workflow", "sort_order")
        indexes = [models.Index(fields=["tenant", "workflow", "is_active"])]

    def __str__(self) -> str:
        return f"{self.workflow}: {self.title}"


class EmployeeTask(TenantOwnedModel):
    employee = models.ForeignKey("hr.Employee", on_delete=models.CASCADE, related_name="tasks")
    # SET_NULL: the issued task is a standalone snapshot and outlives its template.
    template = models.ForeignKey(
        "hr.TaskTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issued_tasks",
    )
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    department = models.CharField(max_length=50, blank=True)
    workflow = models.CharField(
        max_length=20, choices=WorkflowType.choices, default=WorkflowType.ONBOARDING
    )
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_tasks_completed",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_employee_task"
        ordering = ("due_date", "id")
        indexes = [
            models.Index(fields=["employee", "workflow"]),
            models.Index(fields=["tenant", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee_id}: {self.title} [{self.status}]"
