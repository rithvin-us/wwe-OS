"""Pipeline model constraints — idempotency dedup and per-run step ordering."""

from __future__ import annotations

import pytest
from django.db import IntegrityError
from workflow.models import PipelineRun, PipelineRunStatus, PipelineStepRun

pytestmark = pytest.mark.django_db


def test_idempotency_key_is_unique_per_pipeline_and_tenant(tenant):
    PipelineRun.objects.create(
        tenant=tenant, pipeline_key="demo", idempotency_key="rule:1:2026-01-01"
    )
    with pytest.raises(IntegrityError):
        PipelineRun.objects.create(
            tenant=tenant, pipeline_key="demo", idempotency_key="rule:1:2026-01-01"
        )


def test_empty_idempotency_key_is_not_constrained(tenant):
    # Manual triggers pass no idempotency key — must be free to create many.
    PipelineRun.objects.create(tenant=tenant, pipeline_key="demo", idempotency_key="")
    PipelineRun.objects.create(tenant=tenant, pipeline_key="demo", idempotency_key="")
    assert PipelineRun.objects.filter(pipeline_key="demo").count() == 2


def test_step_index_is_unique_per_run(tenant):
    run = PipelineRun.objects.create(tenant=tenant, pipeline_key="demo")
    PipelineStepRun.objects.create(tenant=tenant, run=run, step_index=0, step_key="a")
    with pytest.raises(IntegrityError):
        PipelineStepRun.objects.create(tenant=tenant, run=run, step_index=0, step_key="b")


def test_default_status_is_queued(tenant):
    run = PipelineRun.objects.create(tenant=tenant, pipeline_key="demo")
    assert run.status == PipelineRunStatus.QUEUED
