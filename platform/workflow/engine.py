"""Pipeline execution engine — advances one step at a time, so a crashed
process loses no state (see reclaim_stale_steps) and pause/resume/cancel are
just status flips the next tick honors. Full design rationale:
docs/superpowers/specs/2026-07-24-pipeline-execution-engine-design.md
"""

from __future__ import annotations

import logging
from datetime import timedelta
from enum import StrEnum

from django.db.models import F
from django.utils import timezone
from shared.events import Events, publish

from workflow.models import (
    ACTIVE_STATUSES,
    PipelineRun,
    PipelineRunStatus,
    PipelineStepRun,
    StepRunStatus,
    TerminationReason,
)
from workflow.registry import StepContext, get_pipeline

logger = logging.getLogger("platform.workflow")


class AdvanceOutcome(StrEnum):
    STEP_SUCCEEDED = "step_succeeded"
    RETRYING = "retrying"
    COMPENSATED = "compensated"
    RUN_FINISHED = "run_finished"
    PAUSED = "paused"
    NOT_DUE = "not_due"
    ALREADY_CLAIMED = "already_claimed"


def _claim_step(step_id, *, from_status: str, to_status: str = StepRunStatus.RUNNING) -> bool:
    """Atomically move one step from `from_status` to `to_status`.

    Returns True iff THIS call made the change. A single UPDATE...WHERE is
    atomic on both SQLite (the test backend) and Postgres (production), so
    exactly one of any number of racing callers wins — no lock table, no
    SELECT...FOR UPDATE (which is Postgres-only)."""
    updated = PipelineStepRun.objects.filter(id=step_id, status=from_status).update(
        status=to_status, attempt=F("attempt") + 1, locked_at=timezone.now()
    )
    return updated == 1


def _finish_run(run: PipelineRun, status: str) -> AdvanceOutcome:
    """Atomically transition a run to a terminal status and publish exactly
    once, even if multiple callers race to finish the same run (see
    test_concurrent_finish_only_publishes_once)."""
    updated = PipelineRun.objects.filter(id=run.id, status__in=ACTIVE_STATUSES).update(
        status=status, finished_at=timezone.now(), updated_at=timezone.now()
    )
    run.refresh_from_db()
    if updated:
        event = (
            Events.WORKFLOW_CANCELLED
            if status == PipelineRunStatus.CANCELLED
            else Events.WORKFLOW_COMPLETED
        )
        publish(event, instance=run)
    return AdvanceOutcome.RUN_FINISHED


def advance_one(run: PipelineRun, *, actor=None) -> AdvanceOutcome:
    """Advances exactly one step of `run`. Safe to call repeatedly and
    concurrently — see workflow/management/commands/pipeline_tick.py and
    workflow/services.py's run_to_completion for the two callers."""
    if run.status == PipelineRunStatus.PAUSED:
        return AdvanceOutcome.PAUSED
    if run.status == PipelineRunStatus.COMPENSATING:
        return _advance_compensation(run, actor=actor)

    definition = get_pipeline(run.pipeline_key)
    step_row = run.steps.filter(step_index=run.current_step_index).first()
    if step_row is None:
        return _finish_run(run, PipelineRunStatus.SUCCESS)

    if (
        step_row.status == StepRunStatus.PENDING
        and step_row.next_attempt_at is not None
        and step_row.next_attempt_at > timezone.now()
    ):
        return AdvanceOutcome.NOT_DUE

    if not _claim_step(step_row.id, from_status=StepRunStatus.PENDING):
        return AdvanceOutcome.ALREADY_CLAIMED

    step_row.refresh_from_db()
    if run.status == PipelineRunStatus.QUEUED:
        run.status = PipelineRunStatus.RUNNING
        run.started_at = run.started_at or timezone.now()
        run.save(update_fields=["status", "started_at", "updated_at"])

    step_def = next((s for s in definition.steps if s.key == step_row.step_key), None)
    if step_def is None:
        return _handle_step_failure(
            run,
            step_row,
            None,
            f"Step '{step_row.step_key}' is no longer registered on pipeline '{run.pipeline_key}'.",
            max_attempts=step_row.attempt,  # never retry — the definition is gone
        )

    ctx = StepContext(
        tenant=run.tenant,
        run_id=str(run.id),
        actor=actor,
        data=dict(run.context),
        attempt=step_row.attempt,
    )
    try:
        result = step_def.run(ctx)
    except Exception as exc:  # noqa: BLE001 - a step's own failure, handled below
        return _handle_step_failure(run, step_row, step_def, str(exc))

    step_row.status = StepRunStatus.SUCCESS
    step_row.finished_at = timezone.now()
    step_row.output = result.output
    step_row.locked_at = None
    step_row.save(update_fields=["status", "finished_at", "output", "locked_at", "updated_at"])

    run.context = {**run.context, step_row.step_key: result.output}
    run.current_step_index += 1
    run.save(update_fields=["context", "current_step_index", "updated_at"])
    return AdvanceOutcome.STEP_SUCCEEDED


def _handle_step_failure(
    run: PipelineRun,
    step_row: PipelineStepRun,
    step_def,
    error: str,
    *,
    max_attempts: int | None = None,
) -> AdvanceOutcome:
    limit = max_attempts if max_attempts is not None else (step_def.max_attempts if step_def else 1)
    step_row.error_message = error
    if step_row.attempt < limit:
        step_row.status = StepRunStatus.PENDING
        step_row.locked_at = None
        delay = step_def.backoff(step_row.attempt) if step_def else 0
        step_row.next_attempt_at = timezone.now() + timedelta(seconds=delay)
        step_row.save(
            update_fields=["status", "locked_at", "next_attempt_at", "error_message", "updated_at"]
        )
        return AdvanceOutcome.RETRYING

    step_row.status = StepRunStatus.FAILED
    step_row.finished_at = timezone.now()
    step_row.locked_at = None
    step_row.save(
        update_fields=["status", "finished_at", "locked_at", "error_message", "updated_at"]
    )

    run.termination_reason = TerminationReason.FAILED
    run.status = PipelineRunStatus.COMPENSATING
    run.error_message = error
    run.save(update_fields=["termination_reason", "status", "error_message", "updated_at"])
    return AdvanceOutcome.RETRYING


def _advance_compensation(run: PipelineRun, *, actor=None) -> AdvanceOutcome:
    next_row = run.steps.filter(status=StepRunStatus.SUCCESS).order_by("-step_index").first()
    if next_row is None:
        run.steps.filter(status=StepRunStatus.PENDING).update(status=StepRunStatus.SKIPPED)
        final = (
            PipelineRunStatus.CANCELLED
            if run.termination_reason == TerminationReason.CANCELLED
            else PipelineRunStatus.FAILED
        )
        return _finish_run(run, final)

    if not _claim_step(
        next_row.id, from_status=StepRunStatus.SUCCESS, to_status=StepRunStatus.COMPENSATING
    ):
        return AdvanceOutcome.ALREADY_CLAIMED

    definition = get_pipeline(run.pipeline_key)
    step_def = next((s for s in definition.steps if s.key == next_row.step_key), None)
    ctx = StepContext(
        tenant=run.tenant,
        run_id=str(run.id),
        actor=actor,
        data=dict(run.context),
        attempt=next_row.attempt,
    )
    try:
        if step_def is not None and step_def.compensate is not None:
            step_def.compensate(ctx)
        next_row.status = StepRunStatus.COMPENSATED
    except Exception as exc:  # noqa: BLE001 - logged; unwind of earlier steps still continues
        next_row.status = StepRunStatus.COMPENSATION_FAILED
        next_row.error_message = str(exc)
        logger.exception("Compensation failed for step %s of run %s", next_row.step_key, run.id)
    next_row.finished_at = timezone.now()
    next_row.locked_at = None
    next_row.save(
        update_fields=["status", "error_message", "finished_at", "locked_at", "updated_at"]
    )
    return AdvanceOutcome.COMPENSATED
