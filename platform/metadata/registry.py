"""Per-module metadata extractors — same registry idiom as
periods.registry/workflow.registry. platform/metadata never imports a
business module; each module registers a function that turns one of its
StoredFiles into its business meaning, keyed by the module string
already stamped on every StoredFile (storage/models.py).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from shared.exceptions import NotFoundError


@dataclass(frozen=True)
class MetadataFields:
    title: str
    status: str
    business_object_type: str
    business_object_id: str
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class MetadataProviderDef:
    module: str
    extract: Callable[[Any], MetadataFields | None]


_REGISTRY: dict[str, MetadataProviderDef] = {}


def register_metadata_provider(definition: MetadataProviderDef) -> None:
    _REGISTRY[definition.module] = definition


def get_metadata_provider(module: str) -> MetadataProviderDef:
    definition = _REGISTRY.get(module)
    if definition is None:
        raise NotFoundError(f"No metadata provider registered for module '{module}'.")
    return definition


def all_metadata_providers() -> list[MetadataProviderDef]:
    return sorted(_REGISTRY.values(), key=lambda d: d.module)


def try_get_metadata_provider(module: str) -> MetadataProviderDef | None:
    """Like get_metadata_provider, but returns None instead of raising —
    for callers (MetadataService) that degrade gracefully on an
    unregistered module rather than treating it as an error."""
    return _REGISTRY.get(module)
