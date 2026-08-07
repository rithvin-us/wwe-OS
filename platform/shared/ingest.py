"""Cross-module ingest ports.

A module that can absorb an incoming file (a purchase bill arriving by email,
say) registers a handler here from its ``AppConfig.ready()``; any other part of
the platform routes an artifact to it *by name* and never imports the owning
module. This is the same registry idiom the platform already uses for
``automation.registry`` (source adapters), ``periods.registry`` (document
types), and ``workflow.registry`` (pipelines): the platform never imports a
module — the module carries its handler into the registry.

It exists so cross-module needs go through a platform contract instead of a
direct ``from other_module.services import ...`` call (see the architecture
rule in CLAUDE.md: *modules never import each other*). A missing handler is a
first-class, inspectable state (``get_ingest_handler`` returns ``None``), so a
caller can fall back deliberately rather than swallowing an ``ImportError``.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any


class IngestKind:
    """Canonical names for the kinds of artifact a module can ingest.

    Both the registering module and the routing caller import these constants
    from the platform, so neither has to import the other to agree on a name.
    """

    PURCHASE_BILL = "purchase_bill"


# kind -> handler. A handler is any callable that accepts keyword arguments and
# returns the object it created (or raises on failure). The registry keeps no
# opinion on the signature beyond that; each IngestKind documents its own.
_REGISTRY: dict[str, Callable[..., Any]] = {}


def register_ingest_handler(kind: str, handler: Callable[..., Any]) -> None:
    """Register (or replace) the handler for an ingest kind. Idempotent:
    re-registering the same kind — e.g. an app's ``ready()`` running twice
    under the autoreloader — simply overwrites with the same callable."""
    _REGISTRY[kind] = handler


def get_ingest_handler(kind: str) -> Callable[..., Any] | None:
    """The handler for ``kind``, or ``None`` when no module has registered one.
    Callers branch on ``None`` explicitly instead of relying on exceptions."""
    return _REGISTRY.get(kind)


def has_ingest_handler(kind: str) -> bool:
    return kind in _REGISTRY
