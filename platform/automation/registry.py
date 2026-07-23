"""Source registry — the catalog of modules the automation engine can pull
tagged records and files from.

A module registers a `SourceAdapter` from its `AppConfig.ready()` (same
pattern as the search adapter and report registries): a module slug, the
object type it deals in, the permission gating it, a callable that resolves
which of its own tagged records qualify, and a callable that fetches one
record's file bytes. Not every module has a natural "file" — inventory has
none and registers nothing here; a rule simply can't collect from it.

The platform never imports a module — the module carries its own adapter
into the registry.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from shared.exceptions import NotFoundError


@dataclass(frozen=True)
class CollectedFile:
    filename: str
    content_type: str
    data: bytes


@dataclass(frozen=True)
class SourceAdapter:
    module: str
    label: str
    permission: str
    object_type: str
    # (tenant, tag_ids) -> [{"object_id": str, "title": str}, ...]
    list_tagged: Callable[[Any, list[str]], list[dict[str, str]]]
    # object_id -> CollectedFile, or None when no file exists for that record
    collect_file: Callable[[str], CollectedFile | None]


_REGISTRY: dict[str, SourceAdapter] = {}


def register_source(adapter: SourceAdapter) -> None:
    _REGISTRY[adapter.module] = adapter


def get_source(module: str) -> SourceAdapter:
    adapter = _REGISTRY.get(module)
    if adapter is None:
        raise NotFoundError(f"Automation source '{module}' is not registered.")
    return adapter


def all_sources() -> list[SourceAdapter]:
    return sorted(_REGISTRY.values(), key=lambda a: a.module)


def clear() -> None:
    """Test helper."""
    _REGISTRY.clear()
