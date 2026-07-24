"""Pipeline run API — read access and the pause/resume/cancel/retry
control-plane actions, with permission checks."""

from __future__ import annotations

import pytest
from workflow.models import PipelineRunStatus
from workflow.registry import PipelineDefinition, StepDefinition, StepResult, register_pipeline
from workflow.services import PipelineService

pytestmark = pytest.mark.django_db

RUNS_URL = "/api/v1/workflow/runs/"


@pytest.fixture(autouse=True)
def _register_test_pipeline():
    register_pipeline(
        PipelineDefinition(
            key="test.api.pipeline",
            label="Test",
            module="test",
            permission="test.run",
            version=1,
            steps=[
                StepDefinition(
                    key="only", label="Only", run=lambda ctx: StepResult(), max_attempts=1
                )
            ],
        )
    )


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


def test_list_requires_authentication(api):
    response = api.get(RUNS_URL)
    assert response.status_code == 401


def test_owner_can_list_and_retrieve_runs(tenant, owner, auth_client):
    run, _ = PipelineService().start(pipeline_key="test.api.pipeline", tenant=tenant)

    client = auth_client(owner)
    listed = client.get(RUNS_URL)
    assert listed.status_code == 200
    assert any(r["id"] == str(run.id) for r in listed.data["data"])

    detail = client.get(f"{RUNS_URL}{run.id}/")
    assert detail.status_code == 200
    assert detail.data["pipeline_key"] == "test.api.pipeline"
    assert len(detail.data["steps"]) == 1


def test_pause_resume_cancel_retry_actions(tenant, owner, auth_client):
    run, _ = PipelineService().start(pipeline_key="test.api.pipeline", tenant=tenant)
    client = auth_client(owner)

    paused = client.post(f"{RUNS_URL}{run.id}/pause/")
    assert paused.status_code == 200
    assert paused.data["status"] == PipelineRunStatus.PAUSED

    resumed = client.post(f"{RUNS_URL}{run.id}/resume/")
    assert resumed.status_code == 200
    assert resumed.data["status"] == PipelineRunStatus.QUEUED

    cancelled = client.post(f"{RUNS_URL}{run.id}/cancel/")
    assert cancelled.status_code == 200
    assert cancelled.data["status"] == PipelineRunStatus.COMPENSATING


def test_pause_on_already_paused_run_returns_409(tenant, owner, auth_client):
    run, _ = PipelineService().start(pipeline_key="test.api.pipeline", tenant=tenant)
    client = auth_client(owner)
    client.post(f"{RUNS_URL}{run.id}/pause/")

    response = client.post(f"{RUNS_URL}{run.id}/pause/")

    assert response.status_code == 409


def test_control_actions_require_workflow_control_permission(
    tenant,
    make_user,
    make_role,
    grant,
    auth_client,
):
    viewer = make_user(email="viewer@acme.test", username="viewer", tenant=tenant)
    grant(viewer, make_role(tenant, "viewer", ["workflow.view"]))
    run, _ = PipelineService().start(pipeline_key="test.api.pipeline", tenant=tenant)

    response = auth_client(viewer).post(f"{RUNS_URL}{run.id}/pause/")

    assert response.status_code == 403
