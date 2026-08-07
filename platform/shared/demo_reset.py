"""Demo-data reset registry.

The ``reset_demo_data`` management command clears the platform-owned demo
artifacts it knows about (stored-file rows, the local storage root on disk,
automation/pipeline run history, business periods). Business rows, however,
belong to modules — and the platform never imports a module. So each module
that carries demo data registers a callable that clears *its own* rows, from
its ``AppConfig.ready()`` — the same registry idiom as ``automation.registry``,
``periods.registry``, and ``shared.ingest``.

A resetter takes an optional ``tenant`` (``None`` means every tenant) and must
be idempotent: running it against an already-clean database is a no-op.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

# resetter(tenant=None) -> None
Resetter = Callable[..., Any]

# Keyed by label so a re-run of ready() (e.g. under the autoreloader) replaces
# rather than duplicates a registration.
_RESETTERS: dict[str, Resetter] = {}


def register_demo_resetter(label: str, resetter: Resetter) -> None:
    _RESETTERS[label] = resetter


def all_demo_resetters() -> list[tuple[str, Resetter]]:
    return sorted(_RESETTERS.items())
