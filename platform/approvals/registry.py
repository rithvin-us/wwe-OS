"""Approval source registry.

A module puts its pending human decisions into the one Approval Center by
registering an `ApprovalSource` from its `AppConfig.ready()`. The platform never
imports the module — the source carries the permission that gates viewing, the
permission that gates deciding, a callable that lists a tenant's pending items,
and a callable that records a decision. Same shape as the search / deadline
registries.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from shared.exceptions import ConflictError, NotFoundError


@dataclass(frozen=True)
class Approval:
    kind: str  # stable machine key, e.g. "leave", "expense"
    object_id: str
    title: str
    requester: str
    submitted_at: datetime | None
    priority: str  # "low" | "normal" | "high" | "urgent"
    current_step: str
    url: str
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ApprovalSource:
    kind: str
    label: str
    view_permission: str
    decide_permission: str
    pending: Callable[[Any], Iterable[Approval]]  # (tenant) -> approvals
    # (object_id, *, approve: bool, actor, note) -> None
    decide: Callable[..., None]


_SOURCES: dict[str, ApprovalSource] = {}


def register(source: ApprovalSource) -> None:
    existing = _SOURCES.get(source.kind)
    if existing is not None and existing != source:
        raise ConflictError(f"Approval source '{source.kind}' is already registered.")
    _SOURCES[source.kind] = source


def get(kind: str) -> ApprovalSource:
    source = _SOURCES.get(kind)
    if source is None:
        raise NotFoundError(f"Approval source '{kind}' is not registered.")
    return source


def all_sources() -> list[ApprovalSource]:
    return sorted(_SOURCES.values(), key=lambda s: s.kind)


def unregister(kind: str) -> None:
    """Test helper."""
    _SOURCES.pop(kind, None)
