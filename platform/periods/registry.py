"""Document-type registry — types are code, registered once at import time
from a module's AppConfig.ready(), the same pattern as
workflow.registry.register_pipeline / automation.registry.register_source.
"""

from __future__ import annotations

from dataclasses import dataclass

from shared.exceptions import NotFoundError


@dataclass(frozen=True)
class DocumentTypeDef:
    key: str
    label: str
    folder_segment: str
    is_library: bool
    module: str


_REGISTRY: dict[str, DocumentTypeDef] = {}


def register_document_type(definition: DocumentTypeDef) -> None:
    _REGISTRY[definition.key] = definition


def get_document_type(key: str) -> DocumentTypeDef:
    definition = _REGISTRY.get(key)
    if definition is None:
        raise NotFoundError(f"Document type '{key}' is not registered.")
    return definition


def all_document_types() -> list[DocumentTypeDef]:
    return sorted(_REGISTRY.values(), key=lambda d: d.key)
