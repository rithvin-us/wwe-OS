"""Registers documents as an automation-engine source: which tagged
documents qualify for a rule, and how to fetch one document's stored file."""

from __future__ import annotations

from automation.registry import CollectedFile, SourceAdapter, register_source
from documents.backend.models import Document
from documents.backend.services.document import TAG_MODULE, TAG_OBJECT_TYPE


def _list_tagged(tenant, tag_ids: list[str]) -> list[dict[str, str]]:
    from tagging.services import TagService

    object_ids = TagService().object_ids_for_tags(
        tenant=tenant, module=TAG_MODULE, object_type=TAG_OBJECT_TYPE, tag_ids=tag_ids
    )
    documents = Document.objects.filter(tenant=tenant, id__in=object_ids)
    return [{"object_id": str(d.id), "title": d.title} for d in documents]


def _collect_file(object_id: str) -> CollectedFile | None:
    document = Document.objects.filter(id=object_id).select_related("file").first()
    if document is None or document.file is None:
        return None
    from storage.services import StorageService

    data = StorageService().open(document.file)
    return CollectedFile(
        filename=document.file.filename, content_type=document.file.content_type, data=data
    )


def register_collectible() -> None:
    register_source(
        SourceAdapter(
            module=TAG_MODULE,
            label="Documents",
            permission="documents.read",
            object_type=TAG_OBJECT_TYPE,
            list_tagged=_list_tagged,
            collect_file=_collect_file,
        )
    )
