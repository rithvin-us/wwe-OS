"""Search adapter registration for documents.

Registers the module with the platform search engine (index name, gating
permission, object→document mapping, rebuild source). The platform owns
querying, ranking, tenant isolation, and permission enforcement; the module
only declares how one of its records becomes a search document.
"""

from __future__ import annotations

from documents.backend.models import Document
from search.registry import SearchAdapter, register
from tagging.services import TagService

INDEX = "documents"


def to_document(doc: Document) -> dict:
    tag_names = (
        TagService()
        .tags_for_object(
            tenant=doc.tenant, module="documents", object_type="Document", object_id=str(doc.id)
        )
        .values_list("name", flat=True)
    )
    file_text = ""
    if doc.file:
        try:
            from ai.rag_service import extract_text_from_file
            from storage.services import StorageService

            raw_bytes = StorageService().open(doc.file)
            file_text = extract_text_from_file(raw_bytes, doc.file.content_type, doc.file.filename)
        except Exception:
            file_text = ""

    body = " ".join(
        filter(
            None,
            [doc.description, doc.ai_summary, doc.get_category_display(), file_text, *tag_names],
        )
    )
    return {
        "doc_id": str(doc.id),
        "title": doc.title,
        "body": body,
        "extra": {
            "status": doc.status,
            "document_type": doc.category,
            "period_year": doc.file.period_year,
            "period_month": doc.file.period_month,
            "is_library": doc.file.is_library,
        },
        "url": f"/dms/{doc.id}",
    }


def register_search() -> None:
    register(
        SearchAdapter(
            index=INDEX,
            label="Documents",
            permission="documents.read",
            to_document=to_document,
            queryset=lambda: Document.objects.select_related("file").all(),
        )
    )
