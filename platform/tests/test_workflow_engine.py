"""Pipeline engine — the atomic step-claim primitive, forward execution,
retries, compensation, crash recovery, and batch ticking."""

from __future__ import annotations

import pytest
from workflow.engine import _claim_step
from workflow.models import PipelineRun, PipelineStepRun, StepRunStatus

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
