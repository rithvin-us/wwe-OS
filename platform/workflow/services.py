"""Pipeline control-plane: starting runs, draining them synchronously for
callers that need a blocking result today (automation's run_rule, Task 14),
and the pause/resume/cancel/retry actions an operator can take on a running
pipeline via the API (Task 10).
"""

from __future__ import annotations

import time

from django.utils import timezone
from shared.exceptions import ConflictError
from shared.services import BaseService

from workflow.engine import advance_one
from workflow.models import (
    TERMINAL_STATUSES,
    PipelineRun,
    PipelineRunStatus,
    PipelineStepRun,
    StepRunStatus,
    TerminationReason,
)
from workflow.registry import get_pipeline


class PipelineService(BaseService):
    def start(
        self,
        *,
        pipeline_key: str,
        tenant,
        actor=None,
        trigger_type: str = "manual",
        idempotency_key: str = "",
        source_module: str = "",
        source_object_type: str = "",
        source_object_id: str = "",
        input_data: dict | None = None,
    ) -> tuple[PipelineRun, bool]:
        definition = get_pipeline(pipeline_key)  # NotFoundError if unknown — fail loudly
        fields = {
            "pipeline_version": definition.version,
            "step_keys": [s.key for s in definition.steps],
            "trigger_type": trigger_type,
            "triggered_by": actor,
            "source_module": source_module,
            "source_object_type": source_object_type,
            "source_object_id": source_object_id,
            "context": input_data or {},
        }
        if idempotency_key:
            run, created = PipelineRun.objects.get_or_create(
                tenant=tenant,
                pipeline_key=pipeline_key,
                idempotency_key=idempotency_key,
                defaults=fields,
            )
        else:
            run = PipelineRun.objects.create(
                tenant=tenant, pipeline_key=pipeline_key, idempotency_key="", **fields
            )
            created = True

        if created:
            for index, step in enumerate(definition.steps):
                PipelineStepRun.objects.create(
                    tenant=tenant, run=run, step_index=index, step_key=step.key
                )
        return run, created

    def run_to_completion(
        self, run: PipelineRun, *, actor=None, max_wall_seconds: float = 30.0
    ) -> PipelineRun:
        """Drains a run tick-by-tick in this process until it reaches a
        terminal state. The exact same advance_one() primitive a future
        incremental tick loop uses — no separate 'sync mode' execution
        path to keep correct alongside the real one."""
        deadline = time.monotonic() + max_wall_seconds
        while True:
            run.refresh_from_db()
            if run.status in TERMINAL_STATUSES:
                return run
            advance_one(run, actor=actor)
            if time.monotonic() > deadline:
                raise ConflictError(
                    f"Pipeline run {run.id} did not finish within {max_wall_seconds}s."
                )

    def get_run(self, run_id) -> PipelineRun:
        return PipelineRun.objects.get(id=run_id)

    def request_pause(self, run: PipelineRun) -> PipelineRun:
        updated = PipelineRun.objects.filter(
            id=run.id, status__in=[PipelineRunStatus.QUEUED, PipelineRunStatus.RUNNING]
        ).update(status=PipelineRunStatus.PAUSED, updated_at=timezone.now())
        if not updated:
            raise ConflictError("Only a queued or running pipeline can be paused.")
        run.refresh_from_db()
        return run

    def request_resume(self, run: PipelineRun) -> PipelineRun:
        next_status = PipelineRunStatus.RUNNING if run.started_at else PipelineRunStatus.QUEUED
        updated = PipelineRun.objects.filter(id=run.id, status=PipelineRunStatus.PAUSED).update(
            status=next_status, updated_at=timezone.now()
        )
        if not updated:
            raise ConflictError("Only a paused pipeline can be resumed.")
        run.refresh_from_db()
        return run

    def request_cancel(self, run: PipelineRun) -> PipelineRun:
        updated = PipelineRun.objects.filter(
            id=run.id,
            status__in=[
                PipelineRunStatus.QUEUED,
                PipelineRunStatus.RUNNING,
                PipelineRunStatus.PAUSED,
            ],
        ).update(
            status=PipelineRunStatus.COMPENSATING,
            termination_reason=TerminationReason.CANCELLED,
            updated_at=timezone.now(),
        )
        if not updated:
            raise ConflictError("Only a queued, running, or paused pipeline can be cancelled.")
        run.refresh_from_db()
        return run

    def request_retry(self, run: PipelineRun) -> PipelineRun:
        if run.status != PipelineRunStatus.FAILED:
            raise ConflictError("Only a failed pipeline can be retried.")
        run.steps.filter(status__in=[StepRunStatus.FAILED, StepRunStatus.SKIPPED]).update(
            status=StepRunStatus.PENDING,
            next_attempt_at=None,
            error_message="",
        )
        run.status = PipelineRunStatus.QUEUED
        run.termination_reason = TerminationReason.NONE
        run.error_message = ""
        run.save(update_fields=["status", "termination_reason", "error_message", "updated_at"])
        return run
