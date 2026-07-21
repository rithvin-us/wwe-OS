"""Workflow engine tests — definition sync, lifecycle, authorization, API."""

from __future__ import annotations

import pytest
from audit.models import AuditLog
from notifications.models import Notification
from shared import events as event_bus
from shared.events import Events
from shared.exceptions import ConflictError, PermissionDeniedError, ValidationError
from workflow.models import InstanceStatus, WorkflowStep
from workflow.services import WorkflowService

TWO_STEPS = [
    {"key": "review", "name": "Review", "required_permission": "workflow.act"},
    {"key": "signoff", "name": "Signoff", "required_permission": "workflow.manage"},
]

WORKFLOW_EVENTS = (
    Events.WORKFLOW_STARTED,
    Events.WORKFLOW_STEP_APPROVED,
    Events.WORKFLOW_COMPLETED,
    Events.WORKFLOW_REJECTED,
    Events.WORKFLOW_CANCELLED,
)


@pytest.fixture
def definition(db):
    return WorkflowService().ensure_definition(
        key="generic-approval", name="Generic approval", module="platform", steps=TWO_STEPS
    )


@pytest.fixture
def subject(make_user, tenant):
    """Any model instance can be a workflow subject; a user is convenient."""
    return make_user(email="subject@acme.test", username="subject", tenant=tenant)


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


@pytest.fixture
def approver(make_user, tenant, make_role, grant):
    """Can view and act, but cannot manage — blocked from the signoff step."""
    user = make_user(email="approver@acme.test", username="approver", tenant=tenant)
    grant(user, make_role(tenant, "approver", ["workflow.view", "workflow.act"]))
    return user


@pytest.fixture
def captured_events():
    seen: list[tuple[str, dict]] = []

    def handler(event, **payload):
        seen.append((event, payload))

    for event in WORKFLOW_EVENTS:
        event_bus.subscribe(event, handler)
    yield seen
    for event in WORKFLOW_EVENTS:
        event_bus.unsubscribe(event, handler)


def _started(definition, subject, owner):
    return WorkflowService().start(definition_key=definition.key, subject=subject, started_by=owner)


# --------------------------------------------------------------------------- #
# Definition sync
# --------------------------------------------------------------------------- #


def test_ensure_definition_is_idempotent(db, definition):
    again = WorkflowService().ensure_definition(
        key="generic-approval", name="Generic approval", module="platform", steps=TWO_STEPS
    )
    assert again.id == definition.id
    assert again.version == 1
    assert again.steps.count() == 2


def test_ensure_definition_syncs_step_changes(db, definition):
    changed = [
        {"key": "review", "name": "Renamed review", "required_permission": "workflow.act"},
    ]
    updated = WorkflowService().ensure_definition(
        key="generic-approval", name="Generic approval", module="platform", steps=changed
    )
    assert updated.version == 2
    assert updated.steps.count() == 1  # signoff soft-deleted, not destroyed
    assert WorkflowStep.all_objects.filter(definition=updated).count() == 2
    assert updated.steps.get().name == "Renamed review"


def test_ensure_definition_requires_steps(db):
    with pytest.raises(ValidationError):
        WorkflowService().ensure_definition(key="empty", name="Empty", module="platform", steps=[])


# --------------------------------------------------------------------------- #
# Lifecycle
# --------------------------------------------------------------------------- #


def test_start_sets_first_step_and_notifies_approvers(definition, subject, owner, captured_events):
    instance = _started(definition, subject, owner)

    assert instance.status == InstanceStatus.RUNNING
    assert instance.current_step.key == "review"
    assert instance.actions.get().action == "started"
    assert [event for event, _ in captured_events] == [Events.WORKFLOW_STARTED]
    # The owner holds workflow.act, so they are notified about the review step.
    assert Notification.objects.filter(recipient=owner, category="workflow").exists()
    assert AuditLog.objects.filter(action=Events.WORKFLOW_STARTED, module="workflow").exists()


def test_start_twice_for_same_subject_conflicts(definition, subject, owner):
    _started(definition, subject, owner)
    with pytest.raises(ConflictError):
        _started(definition, subject, owner)


def test_approve_advances_then_completes(definition, subject, owner, approver, captured_events):
    service = WorkflowService()
    instance = _started(definition, subject, owner)

    instance = service.approve(instance=instance, actor=approver, comment="looks right")
    assert instance.status == InstanceStatus.RUNNING
    assert instance.current_step.key == "signoff"

    instance = service.approve(instance=instance, actor=owner)
    assert instance.status == InstanceStatus.APPROVED
    assert instance.current_step is None
    assert instance.completed_at is not None
    assert [event for event, _ in captured_events] == [
        Events.WORKFLOW_STARTED,
        Events.WORKFLOW_STEP_APPROVED,
        Events.WORKFLOW_COMPLETED,
    ]
    assert list(instance.actions.values_list("action", flat=True)) == [
        "started",
        "approved",
        "approved",
    ]


def test_approve_without_step_permission_is_denied(definition, subject, owner, approver):
    service = WorkflowService()
    instance = _started(definition, subject, owner)
    instance = service.approve(instance=instance, actor=approver)  # now at signoff

    with pytest.raises(PermissionDeniedError):
        service.approve(instance=instance, actor=approver)  # needs workflow.manage


def test_reject_requires_reason_and_finishes(definition, subject, owner, captured_events):
    service = WorkflowService()
    instance = _started(definition, subject, owner)

    with pytest.raises(ValidationError):
        service.reject(instance=instance, actor=owner, reason="   ")

    instance = service.reject(instance=instance, actor=owner, reason="wrong amount")
    assert instance.status == InstanceStatus.REJECTED
    assert instance.completed_at is not None
    assert captured_events[-1][0] == Events.WORKFLOW_REJECTED
    assert AuditLog.objects.filter(action=Events.WORKFLOW_REJECTED, module="workflow").exists()


def test_cancel_stops_a_running_workflow(definition, subject, owner, captured_events):
    instance = _started(definition, subject, owner)
    instance = WorkflowService().cancel(instance=instance, actor=owner, reason="subject removed")
    assert instance.status == InstanceStatus.CANCELLED
    assert captured_events[-1][0] == Events.WORKFLOW_CANCELLED


def test_terminal_instance_rejects_further_actions(definition, subject, owner):
    service = WorkflowService()
    instance = _started(definition, subject, owner)
    service.cancel(instance=instance, actor=owner)
    with pytest.raises(ConflictError):
        service.approve(instance=instance, actor=owner)


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #


def test_api_pending_queue_lists_actionable_instances(
    definition, subject, owner, auth_client, make_user
):
    instance = _started(definition, subject, owner)

    response = auth_client(owner).get("/api/v1/workflow/instances/pending/")
    assert response.status_code == 200
    assert [row["id"] for row in response.data["data"]] == [str(instance.id)]

    bystander = make_user(email="nobody@acme.test", username="nobody", tenant=subject.tenant)
    assert auth_client(bystander).get("/api/v1/workflow/instances/pending/").status_code == 403


def test_api_approve_flow_completes_instance(definition, subject, owner, auth_client):
    instance = _started(definition, subject, owner)
    client = auth_client(owner)

    first = client.post(f"/api/v1/workflow/instances/{instance.id}/approve/", {})
    assert first.status_code == 200
    assert first.data["current_step"]["key"] == "signoff"

    second = client.post(f"/api/v1/workflow/instances/{instance.id}/approve/", {})
    assert second.status_code == 200
    assert second.data["status"] == InstanceStatus.APPROVED


def test_api_reject_without_reason_fails_validation(definition, subject, owner, auth_client):
    instance = _started(definition, subject, owner)
    response = auth_client(owner).post(f"/api/v1/workflow/instances/{instance.id}/reject/", {})
    assert response.status_code == 422
    assert response.data["error"]["code"] == "validation_error"


def test_api_cancel_requires_manage_permission(definition, subject, owner, approver, auth_client):
    instance = _started(definition, subject, owner)

    denied = auth_client(approver).post(f"/api/v1/workflow/instances/{instance.id}/cancel/", {})
    assert denied.status_code == 403

    allowed = auth_client(owner).post(f"/api/v1/workflow/instances/{instance.id}/cancel/", {})
    assert allowed.status_code == 200
    assert allowed.data["status"] == InstanceStatus.CANCELLED


def test_api_tenant_isolation(
    definition, subject, owner, other_tenant, make_user, grant, owner_role, auth_client
):
    _started(definition, subject, owner)

    outsider = make_user(email="owner@globex.test", username="globex-owner", tenant=other_tenant)
    grant(outsider, owner_role)
    response = auth_client(outsider).get("/api/v1/workflow/instances/")
    assert response.status_code == 200
    assert response.data["data"] == []
