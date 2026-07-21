"""Report registry — the catalog of reports modules make runnable.

A module registers a `ReportDefinition` from its `AppConfig.ready()` (same
pattern as the search adapter registry): a key, a label, the permission needed
to run it, and a `build_spec(tenant)` callable that returns a `ReportSpec`. The
Reports UI lists the registered reports a user may run and runs them through
`ReportService`. The platform never imports a module — the module carries its
own spec builder into the registry.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from shared.exceptions import NotFoundError


@dataclass(frozen=True)
class ReportDefinition:
    key: str
    label: str
    module: str
    permission: str
    build_spec: Callable[[Any], Any]  # (tenant) -> ReportSpec
    description: str = ""


_REGISTRY: dict[str, ReportDefinition] = {}


def register_report(definition: ReportDefinition) -> None:
    # Idempotent by key — re-registering the same key (e.g. a re-imported
    # AppConfig) simply overwrites, avoiding lambda-identity comparison issues.
    _REGISTRY[definition.key] = definition


def get_report(key: str) -> ReportDefinition:
    definition = _REGISTRY.get(key)
    if definition is None:
        raise NotFoundError(f"Report '{key}' is not registered.")
    return definition


def all_reports() -> list[ReportDefinition]:
    return sorted(_REGISTRY.values(), key=lambda d: (d.module, d.key))


def clear() -> None:
    """Test helper."""
    _REGISTRY.clear()
