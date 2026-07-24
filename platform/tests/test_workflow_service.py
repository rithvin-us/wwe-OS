"""PipelineService — starting runs (with idempotency dedup), synchronous
draining, and the pause/resume/cancel/retry control-plane actions."""

from __future__ import annotations

import pytest
from shared.exceptions import ConflictError
from workflow.models import PipelineRun, PipelineRunStatus, StepRunStatus
from workflow.registry import (
    PipelineDefinition,
    StepContext,
    StepDefinition,
    StepResult,
    register_pipeline,
)
from workflow.services import PipelineService

pytestmark = pytest.mark.django_db


def _register(key, *, run=None, max_attempts=1):
    register_pipeline(
        PipelineDefinition(
            key=key,
            label="Test",
            module="test",
            permission="test.run",
            version=1,
            steps=[
                StepDefinition(
                    key="only",
                    label="Only",
                    run=run or (lambda ctx: StepResult()),
                    max_attempts=max_attempts,
                )
            ],
        )
    )


def test_start_creates_run_and_snapshots_step_keys(tenant):
    _register("test.service.start")

    run, created = PipelineService().start(pipeline_key="test.service.start", tenant=tenant)

    assert created is True
    assert run.step_keys == ["only"]
    assert run.steps.count() == 1
    assert run.status == PipelineRunStatus.QUEUED


def test_start_with_idempotency_key_dedupes_concurrent_callers(tenant):
    _register("test.service.idempotent")

    run1, created1 = PipelineService().start(
        pipeline_key="test.service.idempotent",
        tenant=tenant,
        idempotency_key="same-key",
    )
    run2, created2 = PipelineService().start(
        pipeline_key="test.service.idempotent",
        tenant=tenant,
        idempotency_key="same-key",
    )

    assert created1 is True
    assert created2 is False
    assert run1.id == run2.id
    assert PipelineRun.objects.filter(pipeline_key="test.service.idempotent").count() == 1


def test_start_without_idempotency_key_never_dedupes(tenant):
    _register("test.service.manual")

    run1, _ = PipelineService().start(pipeline_key="test.service.manual", tenant=tenant)
    run2, _ = PipelineService().start(pipeline_key="test.service.manual", tenant=tenant)

    assert run1.id != run2.id


def test_run_to_completion_drains_a_pipeline_synchronously(tenant):
    _register("test.service.drain", run=lambda ctx: StepResult(output={"done": True}))
    run, _ = PipelineService().start(pipeline_key="test.service.drain", tenant=tenant)

    finished = PipelineService().run_to_completion(run)

    assert finished.status == PipelineRunStatus.SUCCESS
    assert finished.context == {"only": {"done": True}}


def test_pause_only_valid_from_queued_or_running(tenant):
    _register("test.service.pause")
    run, _ = PipelineService().start(pipeline_key="test.service.pause", tenant=tenant)

    paused = PipelineService().request_pause(run)
    assert paused.status == PipelineRunStatus.PAUSED

    with pytest.raises(ConflictError):
        PipelineService().request_pause(paused)  # already paused


def test_resume_moves_paused_back_to_queued_or_running(tenant):
    _register("test.service.resume")
    run, _ = PipelineService().start(pipeline_key="test.service.resume", tenant=tenant)
    paused = PipelineService().request_pause(run)

    resumed = PipelineService().request_resume(paused)

    assert resumed.status == PipelineRunStatus.QUEUED  # never started_at, so resumes to QUEUED


def test_resume_on_a_non_paused_run_raises(tenant):
    _register("test.service.resume2")
    run, _ = PipelineService().start(pipeline_key="test.service.resume2", tenant=tenant)

    with pytest.raises(ConflictError):
        PipelineService().request_resume(run)


def test_cancel_routes_through_compensating(tenant):
    _register("test.service.cancel")
    run, _ = PipelineService().start(pipeline_key="test.service.cancel", tenant=tenant)

    cancelled = PipelineService().request_cancel(run)

    assert cancelled.status == PipelineRunStatus.COMPENSATING
    assert cancelled.termination_reason == "cancelled"


def test_retry_only_valid_from_failed(tenant):
    _register("test.service.retry")
    run, _ = PipelineService().start(pipeline_key="test.service.retry", tenant=tenant)

    with pytest.raises(ConflictError):
        PipelineService().request_retry(run)  # still QUEUED, not FAILED


def test_retry_rearms_failed_and_skipped_steps(tenant):
    def always_fails(ctx: StepContext) -> StepResult:
        raise RuntimeError("boom")

    _register("test.service.retry2", run=always_fails, max_attempts=1)
    run, _ = PipelineService().start(pipeline_key="test.service.retry2", tenant=tenant)
    finished = PipelineService().run_to_completion(run)
    assert finished.status == PipelineRunStatus.FAILED

    retried = PipelineService().request_retry(finished)

    assert retried.status == PipelineRunStatus.QUEUED
    step = retried.steps.get(step_index=0)
    assert step.status == StepRunStatus.PENDING
    assert step.error_message == ""


def test_pipeline_tick_command_advances_due_runs(tenant):
    from io import StringIO

    from django.core.management import call_command

    _register("test.command.tick")
    run, _ = PipelineService().start(pipeline_key="test.command.tick", tenant=tenant)

    out = StringIO()
    call_command("pipeline_tick", stdout=out)
    assert "advanced" in out.getvalue().lower()

    run.refresh_from_db()
    assert run.status == PipelineRunStatus.RUNNING  # one tick = one step advanced, not finished
    assert run.current_step_index == 1

    call_command("pipeline_tick", stdout=StringIO())  # second tick notices "no more steps"
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.SUCCESS
