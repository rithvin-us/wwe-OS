"""Pipeline engine — the atomic step-claim primitive, forward execution,
retries, compensation, crash recovery, and batch ticking."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from workflow.engine import AdvanceOutcome, _claim_step, advance_one, reclaim_stale_steps
from workflow.models import PipelineRun, PipelineRunStatus, PipelineStepRun, StepRunStatus
from workflow.registry import (
    PipelineDefinition,
    StepContext,
    StepDefinition,
    StepResult,
    register_pipeline,
)

pytestmark = pytest.mark.django_db


def _make_run_with_step(tenant, *, step_status=StepRunStatus.PENDING) -> PipelineStepRun:
    run = PipelineRun.objects.create(tenant=tenant, pipeline_key="test.pipeline")
    return PipelineStepRun.objects.create(
        tenant=tenant,
        run=run,
        step_index=0,
        step_key="a",
        status=step_status,
    )


def test_claim_succeeds_from_expected_status(tenant):
    step = _make_run_with_step(tenant)

    claimed = _claim_step(step.id, from_status=StepRunStatus.PENDING)

    assert claimed is True
    step.refresh_from_db()
    assert step.status == StepRunStatus.RUNNING
    assert step.attempt == 1
    assert step.locked_at is not None


def test_claim_fails_from_unexpected_status(tenant):
    step = _make_run_with_step(tenant, step_status=StepRunStatus.SUCCESS)

    claimed = _claim_step(step.id, from_status=StepRunStatus.PENDING)

    assert claimed is False
    step.refresh_from_db()
    assert step.status == StepRunStatus.SUCCESS  # unchanged


def test_concurrent_claim_only_one_caller_wins(tenant):
    step = _make_run_with_step(tenant)

    first = _claim_step(step.id, from_status=StepRunStatus.PENDING)
    second = _claim_step(step.id, from_status=StepRunStatus.PENDING)

    assert first is True
    assert second is False


def test_claim_supports_a_different_target_status(tenant):
    step = _make_run_with_step(tenant, step_status=StepRunStatus.SUCCESS)

    claimed = _claim_step(
        step.id, from_status=StepRunStatus.SUCCESS, to_status=StepRunStatus.COMPENSATING
    )

    assert claimed is True
    step.refresh_from_db()
    assert step.status == StepRunStatus.COMPENSATING


# --------------------------------------------------------------------------- #
# Forward execution (advance_one)
# --------------------------------------------------------------------------- #


def _register_single_step_pipeline(key, *, run, max_attempts=1, backoff=None):
    kwargs = dict(key="only", label="Only step", run=run, max_attempts=max_attempts)
    if backoff is not None:
        kwargs["backoff"] = backoff
    register_pipeline(
        PipelineDefinition(
            key=key,
            label="Test",
            module="test",
            permission="test.run",
            version=1,
            steps=[StepDefinition(**kwargs)],
        )
    )


def _start_run(tenant, pipeline_key, *, step_keys=("only",)) -> PipelineRun:
    run = PipelineRun.objects.create(
        tenant=tenant, pipeline_key=pipeline_key, step_keys=list(step_keys)
    )
    for index, key in enumerate(step_keys):
        PipelineStepRun.objects.create(tenant=tenant, run=run, step_index=index, step_key=key)
    return run


def test_advance_one_runs_step_and_finishes_a_single_step_pipeline(tenant):
    _register_single_step_pipeline(
        "test.advance.success", run=lambda ctx: StepResult(output={"ok": True})
    )
    run = _start_run(tenant, "test.advance.success")

    outcome = advance_one(run)
    assert outcome == AdvanceOutcome.STEP_SUCCEEDED
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.RUNNING
    assert run.current_step_index == 1
    assert run.context == {"only": {"ok": True}}

    outcome = advance_one(run)
    assert outcome == AdvanceOutcome.RUN_FINISHED
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.SUCCESS
    assert run.finished_at is not None


def test_advance_one_runs_multi_step_pipeline_in_order(tenant):
    order: list[str] = []

    def step_a(ctx: StepContext) -> StepResult:
        order.append("a")
        return StepResult(output={})

    def step_b(ctx: StepContext) -> StepResult:
        order.append("b")
        return StepResult(output={})

    register_pipeline(
        PipelineDefinition(
            key="test.advance.multi",
            label="Multi",
            module="test",
            permission="test.run",
            version=1,
            steps=[
                StepDefinition(key="a", label="A", run=step_a),
                StepDefinition(key="b", label="B", run=step_b),
            ],
        )
    )
    run = _start_run(tenant, "test.advance.multi", step_keys=("a", "b"))

    advance_one(run)
    run.refresh_from_db()
    advance_one(run)
    run.refresh_from_db()
    assert order == ["a", "b"]
    # 2 steps done, but "no more steps" is only discovered on the next call.
    assert run.status == PipelineRunStatus.RUNNING

    advance_one(run)
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.SUCCESS


def test_step_failure_retries_up_to_max_attempts_respecting_backoff(tenant):
    calls = {"count": 0}

    def flaky(ctx: StepContext) -> StepResult:
        calls["count"] += 1
        raise RuntimeError("transient")

    _register_single_step_pipeline(
        "test.advance.retry", run=flaky, max_attempts=2, backoff=lambda attempt: 3600
    )
    run = _start_run(tenant, "test.advance.retry")

    outcome = advance_one(run)
    assert outcome == AdvanceOutcome.RETRYING
    step = run.steps.get(step_index=0)
    assert step.status == StepRunStatus.PENDING
    assert step.attempt == 1
    assert step.next_attempt_at > timezone.now()

    # Backoff hasn't elapsed (3600s) — a second tick right now must not retry yet.
    outcome = advance_one(run)
    assert outcome == AdvanceOutcome.NOT_DUE
    assert calls["count"] == 1


def test_step_failure_after_exhausted_retries_enters_compensating(tenant):
    def always_fails(ctx: StepContext) -> StepResult:
        raise RuntimeError("permanent")

    _register_single_step_pipeline("test.advance.exhausted", run=always_fails, max_attempts=1)
    run = _start_run(tenant, "test.advance.exhausted")

    advance_one(run)
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.COMPENSATING
    assert run.termination_reason == "failed"
    assert "permanent" in run.error_message
    step = run.steps.get(step_index=0)
    assert step.status == StepRunStatus.FAILED


def test_advance_one_is_a_noop_when_paused(tenant):
    _register_single_step_pipeline("test.advance.paused", run=lambda ctx: StepResult())
    run = _start_run(tenant, "test.advance.paused")
    run.status = PipelineRunStatus.PAUSED
    run.save(update_fields=["status"])

    outcome = advance_one(run)

    assert outcome == AdvanceOutcome.PAUSED
    step = run.steps.get(step_index=0)
    assert step.status == StepRunStatus.PENDING  # untouched


def test_concurrent_finish_only_publishes_once(tenant, monkeypatch):
    """Two racing callers both discovering 'no more steps' must not both
    publish the completion event (and, in automation's later migration,
    must not both create an AutomationRun for the same rule execution)."""
    from workflow import engine

    published = []
    monkeypatch.setattr(engine, "publish", lambda event, **payload: published.append(event))

    _register_single_step_pipeline("test.advance.race", run=lambda ctx: StepResult())
    run = _start_run(tenant, "test.advance.race")
    advance_one(run)  # completes the only step
    run.refresh_from_db()

    # Two callers both see "no more steps" and both call _finish_run.
    from workflow.engine import _finish_run

    _finish_run(run, PipelineRunStatus.SUCCESS)
    _finish_run(run, PipelineRunStatus.SUCCESS)

    assert len(published) == 1


# --------------------------------------------------------------------------- #
# Compensation (rollback)
# --------------------------------------------------------------------------- #


def test_compensation_runs_prior_successful_steps_in_reverse_order(tenant):
    compensated: list[str] = []

    def make_step(key, *, fail=False):
        def run(ctx: StepContext) -> StepResult:
            if fail:
                raise RuntimeError("boom")
            return StepResult(output={})

        def compensate(ctx: StepContext) -> None:
            compensated.append(key)

        return StepDefinition(key=key, label=key, run=run, compensate=compensate, max_attempts=1)

    register_pipeline(
        PipelineDefinition(
            key="test.compensate.order",
            label="Order",
            module="test",
            permission="test.run",
            version=1,
            steps=[make_step("a"), make_step("b"), make_step("c", fail=True)],
        )
    )
    run = _start_run(tenant, "test.compensate.order", step_keys=("a", "b", "c"))

    advance_one(run)
    run.refresh_from_db()  # a succeeds
    advance_one(run)
    run.refresh_from_db()  # b succeeds
    advance_one(run)
    run.refresh_from_db()  # c fails, exhausts retries -> COMPENSATING
    assert run.status == PipelineRunStatus.COMPENSATING

    advance_one(run)
    run.refresh_from_db()  # unwind b
    advance_one(run)
    run.refresh_from_db()  # unwind a
    advance_one(run)
    run.refresh_from_db()  # nothing left -> FAILED

    assert compensated == ["b", "a"]
    assert run.status == PipelineRunStatus.FAILED
    assert run.steps.get(step_key="c").status == StepRunStatus.FAILED
    assert run.steps.get(step_key="b").status == StepRunStatus.COMPENSATED
    assert run.steps.get(step_key="a").status == StepRunStatus.COMPENSATED


def test_compensation_error_on_one_step_does_not_block_unwinding_earlier_steps(tenant):
    def ok_run(ctx: StepContext) -> StepResult:
        return StepResult(output={})

    def failing_compensate(ctx: StepContext) -> None:
        raise RuntimeError("compensate failed")

    def fails(ctx: StepContext) -> StepResult:
        raise RuntimeError("boom")

    register_pipeline(
        PipelineDefinition(
            key="test.compensate.partial",
            label="Partial",
            module="test",
            permission="test.run",
            version=1,
            steps=[
                StepDefinition(key="a", label="a", run=ok_run, compensate=lambda ctx: None),
                StepDefinition(key="b", label="b", run=ok_run, compensate=failing_compensate),
                StepDefinition(key="c", label="c", run=fails, max_attempts=1),
            ],
        )
    )
    run = _start_run(tenant, "test.compensate.partial", step_keys=("a", "b", "c"))
    advance_one(run)
    run.refresh_from_db()
    advance_one(run)
    run.refresh_from_db()
    advance_one(run)
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.COMPENSATING

    advance_one(run)
    run.refresh_from_db()  # unwind b -> fails
    advance_one(run)
    run.refresh_from_db()  # unwind a -> succeeds anyway
    advance_one(run)
    run.refresh_from_db()  # finish

    assert run.steps.get(step_key="b").status == StepRunStatus.COMPENSATION_FAILED
    assert run.steps.get(step_key="a").status == StepRunStatus.COMPENSATED
    assert run.status == PipelineRunStatus.FAILED


def test_cancelling_a_run_lands_on_cancelled_not_failed(tenant):
    _register_single_step_pipeline("test.compensate.cancel", run=lambda ctx: StepResult())
    run = _start_run(tenant, "test.compensate.cancel")
    advance_one(run)
    run.refresh_from_db()  # only step succeeds, run still RUNNING

    run.status = PipelineRunStatus.COMPENSATING
    run.termination_reason = "cancelled"
    run.save(update_fields=["status", "termination_reason"])

    advance_one(run)
    run.refresh_from_db()  # unwind the one succeeded step
    advance_one(run)
    run.refresh_from_db()  # finish

    assert run.status == PipelineRunStatus.CANCELLED


# --------------------------------------------------------------------------- #
# Crash recovery (reclaim_stale_steps)
# --------------------------------------------------------------------------- #


def test_reclaim_resets_stale_running_step_to_pending_when_attempts_remain(tenant, settings):
    settings.PIPELINE_STEP_STALE_TIMEOUT_SECONDS = 60
    _register_single_step_pipeline(
        "test.reclaim.retry", run=lambda ctx: StepResult(), max_attempts=3
    )
    run = _start_run(tenant, "test.reclaim.retry")
    step = run.steps.get(step_index=0)
    step.status = StepRunStatus.RUNNING
    step.attempt = 1
    step.locked_at = timezone.now() - timedelta(seconds=120)
    step.save()

    reclaimed = reclaim_stale_steps()

    assert reclaimed == 1
    step.refresh_from_db()
    assert step.status == StepRunStatus.PENDING
    assert step.locked_at is None
    assert "stale lock" in step.error_message


def test_reclaim_fails_run_when_attempts_exhausted(tenant, settings):
    settings.PIPELINE_STEP_STALE_TIMEOUT_SECONDS = 60
    _register_single_step_pipeline(
        "test.reclaim.exhausted", run=lambda ctx: StepResult(), max_attempts=1
    )
    run = _start_run(tenant, "test.reclaim.exhausted")
    step = run.steps.get(step_index=0)
    step.status = StepRunStatus.RUNNING
    step.attempt = 1  # == max_attempts, no retries left
    step.locked_at = timezone.now() - timedelta(seconds=120)
    step.save()

    reclaim_stale_steps()

    step.refresh_from_db()
    assert step.status == StepRunStatus.FAILED
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.COMPENSATING
    assert run.termination_reason == "failed"


def test_reclaim_ignores_steps_within_the_timeout_window(tenant, settings):
    settings.PIPELINE_STEP_STALE_TIMEOUT_SECONDS = 3600
    _register_single_step_pipeline("test.reclaim.fresh", run=lambda ctx: StepResult())
    run = _start_run(tenant, "test.reclaim.fresh")
    step = run.steps.get(step_index=0)
    step.status = StepRunStatus.RUNNING
    step.locked_at = timezone.now()  # just claimed, well within the timeout
    step.save()

    reclaimed = reclaim_stale_steps()

    assert reclaimed == 0
    step.refresh_from_db()
    assert step.status == StepRunStatus.RUNNING
