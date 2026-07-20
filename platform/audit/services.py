from __future__ import annotations

from typing import Any

from shared import context
from shared.events import Events, publish
from shared.services import BaseService

from audit.models import AuditLog


class AuditService(BaseService):
    def record(
        self,
        *,
        action: str,
        module: str,
        object_type: str = "",
        object_id: str = "",
        changes: dict[str, Any] | None = None,
        actor=None,
        tenant=None,
    ) -> AuditLog:
        ctx = context.get_context()
        actor = actor or context.current_user()
        tenant = tenant or ctx.tenant
        entry = AuditLog.objects.create(
            action=action,
            module=module,
            object_type=object_type,
            object_id=str(object_id or ""),
            changes=changes or {},
            actor=actor if getattr(actor, "pk", None) else None,
            tenant=tenant,
            ip_address=ctx.ip_address,
            user_agent=ctx.user_agent or "",
        )
        publish(Events.AUDIT_RECORDED, instance=entry)
        return entry


# --------------------------------------------------------------------------- #
# Event subscribers — capabilities emit events; audit records them.
# --------------------------------------------------------------------------- #

_MODULE_BY_PREFIX = {
    "user": "users",
    "role": "roles",
    "permission": "permissions",
    "tenant": "tenancy",
    "notification": "notifications",
}


def _on_event(event: str, instance=None, actor=None, changes=None, **_extra) -> None:
    module = _MODULE_BY_PREFIX.get(event.split(".", 1)[0], "platform")
    AuditService().record(
        action=event,
        module=module,
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=getattr(instance, "id", "") if instance is not None else "",
        changes=changes or {},
        actor=actor,
    )


AUDITED_EVENTS = [
    Events.USER_CREATED,
    Events.USER_UPDATED,
    Events.USER_DELETED,
    Events.USER_LOGGED_IN,
    Events.USER_LOGGED_OUT,
    Events.PASSWORD_CHANGED,
    Events.ROLE_CREATED,
    Events.ROLE_CHANGED,
    Events.ROLE_ASSIGNED,
    Events.PERMISSION_ASSIGNED,
    Events.TENANT_CREATED,
]
