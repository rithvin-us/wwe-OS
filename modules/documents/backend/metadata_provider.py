"""Registers this module's metadata extractor with platform/metadata —
turns a documents-owned StoredFile into its business meaning. See
docs/superpowers/specs/2026-07-25-metadata-engine-design.md.
"""

from __future__ import annotations

from documents.backend.models import Document
from metadata.registry import MetadataFields, MetadataProviderDef, register_metadata_provider


def _extract(stored_file) -> MetadataFields | None:
    document = Document.objects.filter(file=stored_file).first()
    if document is None:
        return None
    return MetadataFields(
        title=document.title,
        status=document.status,
        business_object_type="Document",
        business_object_id=str(document.id),
        extra={"category": document.category},
    )


def register_metadata_provider_for_documents() -> None:
    register_metadata_provider(MetadataProviderDef(module="documents", extract=_extract))
