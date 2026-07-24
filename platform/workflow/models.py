"""Pipeline execution engine storage — a PipelineRun (one execution of a
registered PipelineDefinition, see workflow/registry.py) and its
PipelineStepRun children (one row per step, persisted before and after
execution so a crashed process loses no state — see workflow/engine.py).
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class PipelineRunStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    PAUSED = "paused", "Paused"
    COMPENSATING = "compensating", "Compensating"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


ACTIVE_STATUSES = frozenset(
    {PipelineRunStatus.QUEUED, PipelineRunStatus.RUNNING, PipelineRunStatus.COMPENSATING}
)
TERMINAL_STATUSES = frozenset(
    {PipelineRunStatus.SUCCESS, PipelineRunStatus.FAILED, PipelineRunStatus.CANCELLED}
)


class TerminationReason(models.TextChoices):
    NONE = "", "—"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


class PipelineTriggerType(models.TextChoices):
    SCHEDULE = "schedule", "Schedule"
    MANUAL = "manual", "Manual"
    EVENT = "event", "Event"


class StepRunStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"
    SKIPPED = "skipped", "Skipped"
    COMPENSATING = "compensating", "Compensating"
    COMPENSATED = "compensated", "Compensated"
    COMPENSATION_FAILED = "compensation_failed", "Compensation failed"


class PipelineRun(TenantOwnedModel):
    pipeline_key = models.CharField(max_length=100, db_index=True)
    pipeline_version = models.PositiveIntegerField(default=1)
    # Step order snapshotted at start() — frozen so a later registry change
    # can't corrupt an in-flight run's meaning.
    step_keys = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=13,
        choices=PipelineRunStatus.choices,
        default=PipelineRunStatus.QUEUED,
        db_index=True,
    )
    termination_reason = models.CharField(
        max_length=10,
        choices=TerminationReason.choices,
        blank=True,
        default=TerminationReason.NONE,
    )
    current_step_index = models.PositiveIntegerField(default=0)
    # Accumulates {step_key: StepResult.output} as steps succeed.
    context = models.JSONField(default=dict, blank=True)
    trigger_type = models.CharField(
        max_length=10,
        choices=PipelineTriggerType.choices,
        default=PipelineTriggerType.SCHEDULE,
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    # Opaque back-reference — same (module, object_type, object_id) idiom
    # platform/tagging already uses, so the engine never needs a FK to any
    # business model.
    source_module = models.CharField(max_length=50, blank=True, default="")
    source_object_type = models.CharField(max_length=100, blank=True, default="")
    source_object_id = models.CharField(max_length=64, blank=True, default="")
    # Non-empty only for scheduled triggers — see automation's use in Task 14.
    idempotency_key = models.CharField(max_length=200, blank=True, default="")
    queued_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")

    class Meta(TenantOwnedModel.Meta):
        db_table = "pipeline_run"
        indexes = [
            models.Index(fields=["tenant", "status", "pipeline_key"]),
            models.Index(
                fields=["tenant", "source_module", "source_object_type", "source_object_id"]
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "pipeline_key", "idempotency_key"],
                condition=~models.Q(idempotency_key=""),
                name="uniq_pipeline_run_idempotency",
            )
        ]

    def __str__(self) -> str:
        return f"{self.pipeline_key} · {self.status}"


class PipelineStepRun(TenantOwnedModel):
    run = models.ForeignKey(PipelineRun, on_delete=models.CASCADE, related_name="steps")
    step_index = models.PositiveIntegerField()
    step_key = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20,
        choices=StepRunStatus.choices,
        default=StepRunStatus.PENDING,
    )
    attempt = models.PositiveIntegerField(default=0)
    next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)
    locked_at = models.DateTimeField(null=True, blank=True, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    output = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default="")

    class Meta(TenantOwnedModel.Meta):
        db_table = "pipeline_step_run"
        ordering = ["step_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["run", "step_index"], name="uniq_pipeline_step_run_index"
            )
        ]
        indexes = [models.Index(fields=["status", "locked_at"])]

    def __str__(self) -> str:
        return f"{self.run_id} · {self.step_key} · {self.status}"
