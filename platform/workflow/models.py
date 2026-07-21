"""Generic workflow & approval engine — models.

The engine owns process mechanics (definitions, steps, instances, actions);
modules own meaning. A module declares a definition (usually from its
post_migrate hook via `WorkflowService.ensure_definition`), starts an instance
for one of its objects, and reacts to `workflow.*` events. The engine never
imports a module — the subject of an instance is an opaque (model label, pk)
pair, exactly like audit records reference objects.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import BaseModel, TenantOwnedModel


class InstanceStatus(models.TextChoices):
    RUNNING = "running", "Running"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    CANCELLED = "cancelled", "Cancelled"


class ActionType(models.TextChoices):
    STARTED = "started", "Started"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    CANCELLED = "cancelled", "Cancelled"


class WorkflowDefinition(BaseModel):
    """A named, versioned approval process.

    tenant NULL = platform-wide definition available to every tenant; a
    tenant-specific row with the same key overrides it — mirroring how system
    vs custom roles work.
    """

    tenant = models.ForeignKey(
        "tenancy.Tenant",
        on_delete=models.CASCADE,
        related_name="workflow_definitions",
        null=True,
        blank=True,
        db_index=True,
    )
    key = models.SlugField(max_length=100)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    module = models.CharField(max_length=50, help_text="Owning module slug, e.g. 'purchase'.")
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        db_table = "workflow_definition"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "key"],
                name="uniq_workflow_key_per_tenant",
                condition=models.Q(tenant__isnull=False),
            ),
            models.UniqueConstraint(
                fields=["key"],
                name="uniq_platform_workflow_key",
                condition=models.Q(tenant__isnull=True),
            ),
        ]

    def __str__(self) -> str:
        return f"{self.key} v{self.version}"


class WorkflowStep(BaseModel):
    """One sequential approval stage.

    Who may act is expressed as a platform permission code — the engine stays
    ignorant of business meaning and reuses the exact RBAC mechanism every
    API endpoint already uses. Removed steps are soft-deleted so running
    instances keep their FK history intact.
    """

    definition = models.ForeignKey(
        WorkflowDefinition, on_delete=models.CASCADE, related_name="steps"
    )
    order = models.PositiveIntegerField()
    key = models.SlugField(max_length=100)
    name = models.CharField(max_length=200)
    required_permission = models.CharField(max_length=100)

    class Meta(BaseModel.Meta):
        db_table = "workflow_step"
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=["definition", "key"], name="uniq_step_key_per_definition"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.definition_id}:{self.key}"


class WorkflowInstance(TenantOwnedModel):
    """A running (or finished) approval for exactly one subject object.

    The partial unique constraint guarantees at most one RUNNING instance per
    subject even under concurrent starts.
    """

    definition = models.ForeignKey(
        WorkflowDefinition, on_delete=models.PROTECT, related_name="instances"
    )
    subject_type = models.CharField(
        max_length=100, help_text="Model label, e.g. 'purchase.purchasebill'."
    )
    subject_id = models.CharField(max_length=64)
    status = models.CharField(
        max_length=20,
        choices=InstanceStatus.choices,
        default=InstanceStatus.RUNNING,
        db_index=True,
    )
    current_step = models.ForeignKey(
        WorkflowStep, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="workflow_instances_started",
    )
    context = models.JSONField(default=dict, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        db_table = "workflow_instance"
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["subject_type", "subject_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "subject_type", "subject_id"],
                name="uniq_running_workflow_per_subject",
                condition=models.Q(status="running"),
            ),
        ]

    def __str__(self) -> str:
        return f"{self.definition_id} → {self.subject_type}:{self.subject_id} [{self.status}]"


class WorkflowAction(BaseModel):
    """Immutable trail of everything that happened to an instance."""

    instance = models.ForeignKey(WorkflowInstance, on_delete=models.CASCADE, related_name="actions")
    step = models.ForeignKey(
        WorkflowStep, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="workflow_actions",
    )
    action = models.CharField(max_length=20, choices=ActionType.choices)
    comment = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        db_table = "workflow_action"
        ordering = ("created_at",)
