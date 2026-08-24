"""Operator-facing alerting driven by platform events.

A failed background pipeline is an operational exception the single operator
must see — this raises an in-app notification to the tenant's Owner when the
workflow engine reports a run failed (`WORKFLOW_FAILED`). Cancellations are
operator-initiated, so they are deliberately not alerted on; only genuine
failures are. The publisher (workflow) knows nothing about notifications;
this subscriber is where that meaning lives, the same separation automation's
own subscriber keeps.
"""

from __future__ import annotations

from typing import Any

from shared.events import Events, subscribe


def _pipeline_label(pipeline_key: str) -> str:
    """The human label for a pipeline, falling back to its key if the
    definition isn't registered in this process (e.g. a run left over from a
    module that has since been removed)."""
    try:
        from workflow.registry import get_pipeline

        return get_pipeline(pipeline_key).label
    except Exception:  # noqa: BLE001 - unknown key; the key itself is a fine fallback
        return pipeline_key


def _on_pipeline_failed(event: str, instance: Any = None, **_extra: Any) -> None:
    run = instance
    if run is None or getattr(run, "tenant_id", None) is None:
        return

    from notifications.models import Priority
    from notifications.services import NotificationService
    from roles.models import UserRole

    # Single-operator model — the tenant has exactly one Owner, the one
    # destination an operational alert goes to (mirrors AlertService._send).
    owner = (
        UserRole.objects.filter(role__slug="owner", user__tenant=run.tenant)
        .select_related("user")
        .first()
    )
    if owner is None:
        return

    label = _pipeline_label(run.pipeline_key)
    detail = (run.error_message or "").strip()
    body = f'"{label}" failed and its changes were rolled back.'
    if detail:
        body = f"{body} {detail}"

    NotificationService().create(
        recipient=owner.user,
        title="A background task failed",
        body=body,
        category="alert",
        priority=Priority.HIGH,
        tenant=run.tenant,
        data={"pipeline_key": run.pipeline_key, "run_id": str(run.id)},
    )


subscribe(Events.WORKFLOW_FAILED, _on_pipeline_failed)
