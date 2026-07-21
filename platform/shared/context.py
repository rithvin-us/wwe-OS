"""Per-request context, stored in a thread-local.

Lets any layer (managers, services, audit) read the current tenant, actor,
and request metadata without threading them through every call. Populated by
the request-context and tenant middleware; empty in background/CLI contexts.
"""

from __future__ import annotations

import contextlib
import threading
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

_state = threading.local()


@dataclass
class RequestContext:
    tenant: Any = None
    tenant_id: Any = None
    user: Any = None
    ip_address: str | None = None
    user_agent: str | None = None
    request_id: str | None = None


def get_context() -> RequestContext:
    ctx = getattr(_state, "context", None)
    if ctx is None:
        ctx = RequestContext()
        _state.context = ctx
    return ctx


def set_context(**fields: Any) -> None:
    ctx = get_context()
    for key, value in fields.items():
        setattr(ctx, key, value)


def clear_context() -> None:
    _state.context = RequestContext()


def current_tenant() -> Any:
    return get_context().tenant


def current_tenant_id() -> Any:
    ctx = get_context()
    return ctx.tenant_id or (ctx.tenant.id if ctx.tenant is not None else None)


def current_user() -> Any:
    user = get_context().user
    return user if (user is not None and getattr(user, "is_authenticated", False)) else None


def current_request_id() -> str | None:
    return get_context().request_id


@contextlib.contextmanager
def tenant_context(tenant: Any) -> Iterator[None]:
    """Temporarily run inside a tenant (tests, background jobs)."""
    previous = get_context()
    set_context(tenant=tenant, tenant_id=getattr(tenant, "id", None))
    try:
        yield
    finally:
        _state.context = previous
