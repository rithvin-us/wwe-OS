"""Pipeline/step registry — register/get/all, same contract as
reporting.registry and automation.registry."""

from __future__ import annotations

import pytest
from shared.exceptions import NotFoundError
from workflow.registry import (
    PipelineDefinition,
    StepContext,
    StepDefinition,
    StepResult,
    default_backoff,
    get_pipeline,
    register_pipeline,
)


def _noop(ctx: StepContext) -> StepResult:
    return StepResult(output={"ran": True})


def test_register_and_get_round_trip():
    definition = PipelineDefinition(
        key="test.pipeline.one",
        label="Test one",
        module="test",
        permission="test.run",
        version=1,
        steps=[StepDefinition(key="step-a", label="Step A", run=_noop)],
    )
    register_pipeline(definition)

    fetched = get_pipeline("test.pipeline.one")
    assert fetched.key == "test.pipeline.one"
    assert fetched.steps[0].key == "step-a"


def test_get_unregistered_pipeline_raises():
    with pytest.raises(NotFoundError):
        get_pipeline("does.not.exist")


def test_register_is_idempotent_by_key():
    from workflow.registry import all_pipelines

    definition_v1 = PipelineDefinition(
        key="test.pipeline.two",
        label="v1",
        module="test",
        permission="test.run",
        version=1,
        steps=[StepDefinition(key="a", label="A", run=_noop)],
    )
    definition_v2 = PipelineDefinition(
        key="test.pipeline.two",
        label="v2",
        module="test",
        permission="test.run",
        version=2,
        steps=[StepDefinition(key="a", label="A", run=_noop)],
    )
    register_pipeline(definition_v1)
    register_pipeline(definition_v2)

    assert get_pipeline("test.pipeline.two").label == "v2"
    assert [p.key for p in all_pipelines()].count("test.pipeline.two") == 1


def test_default_backoff_is_exponential_and_capped():
    assert default_backoff(0) == 1
    assert default_backoff(1) == 2
    assert default_backoff(2) == 4
    assert default_backoff(20) == 300  # capped
