"""Search adapter registry.

A module makes itself searchable by registering an adapter from its
`AppConfig.ready()`. The platform never imports the module — the adapter
carries everything the engine needs: which permission gates the index, how to
turn a business object into a document, and how to enumerate objects for a
full rebuild.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Any

from shared.exceptions import ConflictError, NotFoundError


@dataclass(frozen=True)
class SearchAdapter:
    index: str
    label: str
    permission: str  # platform permission code required to see results
    to_document: Callable[[Any], dict]  # object → {doc_id,title,body,extra,url}
    queryset: Callable[[], Iterable[Any]] | None = None  # for rebuilds


_ADAPTERS: dict[str, SearchAdapter] = {}


def register(adapter: SearchAdapter) -> None:
    existing = _ADAPTERS.get(adapter.index)
    if existing is not None and existing != adapter:
        raise ConflictError(f"Search index '{adapter.index}' is already registered.")
    _ADAPTERS[adapter.index] = adapter


def get(index: str) -> SearchAdapter:
    adapter = _ADAPTERS.get(index)
    if adapter is None:
        raise NotFoundError(f"Search index '{index}' is not registered.")
    return adapter


def all_adapters() -> list[SearchAdapter]:
    return sorted(_ADAPTERS.values(), key=lambda a: a.index)


def unregister(index: str) -> None:
    """Test helper."""
    _ADAPTERS.pop(index, None)
