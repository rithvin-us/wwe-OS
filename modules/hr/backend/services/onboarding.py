"""Onboarding / offboarding checklists.

Migrated from the legacy app's `onboarding_service`. Behaviour preserved:

- Templates are seeded once per tenant, idempotently.
- Generation is idempotent per (employee, workflow) — an employee only ever gets
  one set of tasks per workflow, so the create/offboard hooks stay harmless if
  they fire twice.
- Due dates are anchored on joining (onboarding) or leaving (offboarding).
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from audit.services import AuditService
from django.db import transaction
from django.utils import timezone
from shared import context

from hr.backend.models import (
    Employee,
    EmployeeTask,
    TaskStatus,
    TaskTemplate,
    WorkflowType,
)

logger = logging.getLogger(__name__)

MODULE = "hr"

DEFAULT_TEMPLATES = [
    # Onboarding
    {
        "workflow": "onboarding",
        "title": "Setup Email Account",
        "department": "IT",
        "description": "Create corporate email and grant baseline access.",
        "default_due_days": 1,
        "sort_order": 1,
    },
    {
        "workflow": "onboarding",
        "title": "Assign Desk & Workspace",
        "department": "Admin",
        "description": "Allocate seating, desk, and stationery.",
        "default_due_days": 1,
        "sort_order": 2,
    },
    {
        "workflow": "onboarding",
        "title": "Issue ID Card",
        "department": "HR",
        "description": "Print and hand over employee ID / access card.",
        "default_due_days": 3,
        "sort_order": 3,
    },
    {
        "workflow": "onboarding",
        "title": "Provision Laptop / Equipment",
        "department": "IT",
        "description": "Assign hardware from IT asset inventory.",
        "default_due_days": 3,
        "sort_order": 4,
    },
    {
        "workflow": "onboarding",
        "title": "Enrol for Face Check-in",
        "department": "HR",
        "description": "Capture enrolment photo for attendance self check-in.",
        "default_due_days": 5,
        "sort_order": 5,
    },
    {
        "workflow": "onboarding",
        "title": "Payroll & Bank Details Verification",
        "department": "Finance",
        "description": "Verify bank account, PF/UAN/ESIC numbers.",
        "default_due_days": 7,
        "sort_order": 6,
    },
    {
        "workflow": "onboarding",
        "title": "Policy Induction",
        "department": "HR",
        "description": "Walk through company policies and code of conduct.",
        "default_due_days": 7,
        "sort_order": 7,
    },
    # Offboarding
    {
        "workflow": "offboarding",
        "title": "Revoke System Access",
        "department": "IT",
        "description": "Disable email, VPN, and application accounts.",
        "default_due_days": 0,
        "sort_order": 1,
    },
    {
        "workflow": "offboarding",
        "title": "Collect Assets",
        "department": "IT",
        "description": "Recover laptop, phone, and other assigned assets.",
        "default_due_days": 2,
        "sort_order": 2,
    },
    {
        "workflow": "offboarding",
        "title": "Collect ID Card",
        "department": "HR",
        "description": "Recover ID / access card.",
        "default_due_days": 0,
        "sort_order": 3,
    },
    {
        "workflow": "offboarding",
        "title": "Full & Final Settlement",
        "department": "Finance",
        "description": "Clear dues, unrecovered advances, and final payroll.",
        "default_due_days": 30,
        "sort_order": 4,
    },
    {
        "workflow": "offboarding",
        "title": "Exit Interview",
        "department": "HR",
        "description": "Conduct exit interview and record feedback.",
        "default_due_days": 5,
        "sort_order": 5,
    },
]


class OnboardingService:
    def __init__(self) -> None:
        self.audit = AuditService()

    def seed_default_templates(self, tenant=None) -> int:
        """Insert the standard templates if this tenant has none. Idempotent."""
        tenant = tenant or context.current_tenant()
        if TaskTemplate.objects.filter(tenant=tenant).exists():
            return 0
        TaskTemplate.objects.bulk_create(
            [TaskTemplate(tenant=tenant, **definition) for definition in DEFAULT_TEMPLATES]
        )
        logger.info("Seeded %d default task templates", len(DEFAULT_TEMPLATES))
        return len(DEFAULT_TEMPLATES)

    @transaction.atomic
    def generate_for_employee(
        self, *, employee: Employee, workflow: str, anchor_date: date | None = None
    ) -> list[EmployeeTask]:
        """Instantiate every active template of `workflow` for one employee.

        Returns an empty list if the employee already has tasks for this
        workflow, so calling it again is a no-op rather than a duplicate set.
        """
        self.seed_default_templates(tenant=employee.tenant)

        if EmployeeTask.objects.filter(employee=employee, workflow=workflow).exists():
            return []

        if anchor_date is None:
            anchor_date = (
                employee.date_of_leaving
                if workflow == WorkflowType.OFFBOARDING and employee.date_of_leaving
                else employee.date_of_joining
            )

        templates = TaskTemplate.objects.filter(
            tenant_id=employee.tenant_id, workflow=workflow, is_active=True
        ).order_by("sort_order")

        tasks = [
            EmployeeTask(
                tenant_id=employee.tenant_id,
                employee=employee,
                template=template,
                title=template.title,
                description=template.description,
                department=template.department,
                workflow=workflow,
                due_date=(
                    anchor_date + timedelta(days=template.default_due_days) if anchor_date else None
                ),
            )
            for template in templates
        ]
        EmployeeTask.objects.bulk_create(tasks)

        logger.info(
            "Generated %d %s tasks for employee %s",
            len(tasks),
            workflow,
            employee.employee_code,
        )
        return tasks

    def complete(self, *, task: EmployeeTask, actor=None) -> EmployeeTask:
        task.status = TaskStatus.COMPLETED
        task.completed_at = timezone.now()
        task.completed_by = actor or context.current_user()
        task.save(update_fields=["status", "completed_at", "completed_by", "updated_at"])

        self.audit.record(
            action="hr.onboarding.task_completed",
            module=MODULE,
            object_type="EmployeeTask",
            object_id=str(task.pk),
            changes={"title": task.title, "workflow": task.workflow},
        )
        return task

    def reopen(self, *, task: EmployeeTask) -> EmployeeTask:
        task.status = TaskStatus.PENDING
        task.completed_at = None
        task.completed_by = None
        task.save(update_fields=["status", "completed_at", "completed_by", "updated_at"])
        return task
