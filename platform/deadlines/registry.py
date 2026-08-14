"""Deadline source registry.

A module makes its date-sensitive records show up in the one Deadline Engine by
registering a `DeadlineSource` from its `AppConfig.ready()`. The platform never
imports the module — the source carries everything the engine needs: the
permission that gates it, and a callable that enumerates a tenant's upcoming
(and overdue) deadlines within a horizon. Same shape as the search registry.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from shared.exceptions import ConflictError


@dataclass(frozen=True)
class Deadline:
    kind: str  # stable machine key, e.g. "invoice_due", "contract_expiry"
    label: str  # human title, e.g. "G/M/12/2026-27 · Acme"
    due_date: date
    days_remaining: int  # negative when overdue
    is_overdue: bool
    url: str  # frontend route to the source record
    object_id: str
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class DeadlineSource:
    kind: str
    label: str
    permission: str  # platform permission code required to see these
    upcoming: Callable[[Any, int], Iterable[Deadline]]  # (tenant, within_days) -> deadlines


_SOURCES: dict[str, DeadlineSource] = {}


def register(source: DeadlineSource) -> None:
    existing = _SOURCES.get(source.kind)
    if existing is not None and existing != source:
        raise ConflictError(f"Deadline source '{source.kind}' is already registered.")
    _SOURCES[source.kind] = source


def all_sources() -> list[DeadlineSource]:
    return sorted(_SOURCES.values(), key=lambda s: s.kind)


def unregister(kind: str) -> None:
    """Test helper."""
    _SOURCES.pop(kind, None)
