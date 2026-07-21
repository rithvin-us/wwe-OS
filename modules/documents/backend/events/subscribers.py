"""Wires document events into platform capabilities.

Two directions, both through public platform surfaces only:
- Module events (documents.*) → the audit trail.
- Platform workflow events (workflow.completed / workflow.rejected) → advance
  the document whose approval just finished. This is how the module reacts to
  the platform workflow engine without the engine ever knowing what a Document
  is.
"""

from __future__ import annotations

from typing import Any

from documents.backend.events.registry import ALL_EVENTS
from shared.events import Events, subscribe


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    AuditService().record(
        action=event,
        module="documents",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes={
            "title": getattr(instance, "title", ""),
            "status": getattr(instance, "status", ""),
            "category": getattr(instance, "category", ""),
        },
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


def _on_workflow_finished(
    event: str, instance: Any = None, actor: Any = None, **_extra: Any
) -> None:
    """React only to approvals whose subject is one of our documents."""
    if instance is None or instance.subject_type != "documents.document":
        return
    from documents.backend.models import Document
    from documents.backend.services.document import DocumentService
    from notifications.services import NotificationService

    # Scope by the instance's own tenant, not the ambient request context —
    # correct today and still correct if event dispatch becomes async, where
    # no tenant context is set.
    document = Document.objects.filter(id=instance.subject_id, tenant=instance.tenant).first()
    if document is None:
        return

    service = DocumentService()
    if event == Events.WORKFLOW_COMPLETED:
        service.mark_approved(document)
        title, body = "Document approved", f"'{document.title}' was approved."
    else:  # WORKFLOW_REJECTED
        service.mark_rejected(document)
        title, body = "Document returned", f"'{document.title}' was returned for revision."

    if document.owner is not None:
        NotificationService().create(
            recipient=document.owner,
            tenant=document.tenant,
            title=title,
            body=body,
            category="documents",
            data={"document_id": str(document.id)},
        )


def register_subscribers() -> None:
    for event in ALL_EVENTS:
        subscribe(event, _record_audit)
    subscribe(Events.WORKFLOW_COMPLETED, _on_workflow_finished)
    subscribe(Events.WORKFLOW_REJECTED, _on_workflow_finished)
