"""The alerts subscriber that turns a WORKFLOW_FAILED event into an in-app
notification for the operator (platform/alerts/subscribers.py). Only genuine
failures alert — success and operator-initiated cancellation stay quiet.
"""

from __future__ import annotations

import pytest
from notifications.models import Notification, Priority
from workflow.models import PipelineRunStatus
from workflow.registry import (
    PipelineDefinition,
    StepContext,
    StepDefinition,
    StepResult,
    register_pipeline,
)
from workflow.services import PipelineService

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


def _register(key, *, run, label="Test pipeline"):
    register_pipeline(
        PipelineDefinition(
            key=key,
            label=label,
            module="test",
            permission="test.run",
            version=1,
            steps=[StepDefinition(key="only", label="Only", run=run, max_attempts=1)],
        )
    )


def _fail(ctx: StepContext) -> StepResult:
    raise RuntimeError("step blew up")


def test_failed_pipeline_notifies_the_owner(tenant, owner):
    _register("test.alert.fail", run=_fail, label="Collect and package")
    run, _ = PipelineService().start(pipeline_key="test.alert.fail", tenant=tenant)

    finished = PipelineService().run_to_completion(run)

    assert finished.status == PipelineRunStatus.FAILED
    note = Notification.objects.get(recipient=owner)
    assert note.title == "A background task failed"
    assert note.priority == Priority.HIGH
    assert note.category == "alert"
    assert "Collect and package" in note.body
    assert "step blew up" in note.body
    assert note.data["pipeline_key"] == "test.alert.fail"
    assert note.data["run_id"] == str(run.id)


def test_successful_pipeline_does_not_notify(tenant, owner):
    _register("test.alert.ok", run=lambda ctx: StepResult())
    run, _ = PipelineService().start(pipeline_key="test.alert.ok", tenant=tenant)

    finished = PipelineService().run_to_completion(run)

    assert finished.status == PipelineRunStatus.SUCCESS
    assert Notification.objects.filter(recipient=owner).count() == 0


def test_cancelled_pipeline_does_not_notify(tenant, owner):
    _register("test.alert.cancel", run=lambda ctx: StepResult())
    run, _ = PipelineService().start(pipeline_key="test.alert.cancel", tenant=tenant)
    PipelineService().request_cancel(run)  # operator-initiated

    finished = PipelineService().run_to_completion(run)

    assert finished.status == PipelineRunStatus.CANCELLED
    assert Notification.objects.filter(recipient=owner).count() == 0


def test_failure_without_an_owner_is_silent_and_still_fails_the_run(tenant):
    # No Owner granted for this tenant — a failing subscriber must never break
    # the engine, and there is simply no one to notify.
    _register("test.alert.noowner", run=_fail)
    run, _ = PipelineService().start(pipeline_key="test.alert.noowner", tenant=tenant)

    finished = PipelineService().run_to_completion(run)

    assert finished.status == PipelineRunStatus.FAILED
    assert Notification.objects.count() == 0
