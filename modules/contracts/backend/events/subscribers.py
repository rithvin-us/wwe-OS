"""Wires contract events into the audit trail, and reacts to platform workflow
completion to advance the contract. Both through public platform surfaces only.
"""

from __future__ import annotations

from typing import Any

from contracts.backend.events.registry import ALL_EVENTS
from shared.events import Events, subscribe


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    AuditService().record(
        action=event,
        module="contracts",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes={
            "title": getattr(instance, "title", ""),
            "counterparty": getattr(instance, "counterparty", ""),
            "status": getattr(instance, "status", ""),
        },
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


def _on_workflow_finished(
    event: str, instance: Any = None, actor: Any = None, **_extra: Any
) -> None:
    if instance is None or instance.subject_type != "contracts.contract":
        return
    from contracts.backend.models import Contract
    from contracts.backend.services.contract import ContractService
    from notifications.services import NotificationService

    # Scope by the instance's own tenant, not ambient context — correct today
    # and still correct under future async event dispatch.
    contract = Contract.objects.filter(id=instance.subject_id, tenant=instance.tenant).first()
    if contract is None:
        return

    service = ContractService()
    if event == Events.WORKFLOW_COMPLETED:
        service.mark_active(contract)
        title, body = "Contract approved", f"'{contract.title}' is now active."
    else:  # WORKFLOW_REJECTED
        service.mark_rejected(contract)
        title, body = "Contract returned", f"'{contract.title}' was returned for revision."

    if contract.owner is not None:
        NotificationService().create(
            recipient=contract.owner,
            tenant=contract.tenant,
            title=title,
            body=body,
            category="contracts",
            data={"contract_id": str(contract.id)},
        )


def register_subscribers() -> None:
    for event in ALL_EVENTS:
        subscribe(event, _record_audit)
    subscribe(Events.WORKFLOW_COMPLETED, _on_workflow_finished)
    subscribe(Events.WORKFLOW_REJECTED, _on_workflow_finished)
