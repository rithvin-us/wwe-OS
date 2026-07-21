"""Search adapter registration for documents.

Registers the module with the platform search engine (index name, gating
permission, object→document mapping, rebuild source). The platform owns
querying, ranking, tenant isolation, and permission enforcement; the module
only declares how one of its records becomes a search document.
"""

from __future__ import annotations

from documents.backend.models import Document
from search.registry import SearchAdapter, register

INDEX = "documents"


def to_document(doc: Document) -> dict:
    body = " ".join(filter(None, [doc.description, doc.ai_summary, doc.get_category_display()]))
    return {
        "doc_id": str(doc.id),
        "title": doc.title,
        "body": body,
        "extra": {"status": doc.status, "category": doc.category},
        "url": f"/dms/{doc.id}",
    }


def register_search() -> None:
    register(
        SearchAdapter(
            index=INDEX,
            label="Documents",
            permission="documents.read",
            to_document=to_document,
            queryset=lambda: Document.objects.all(),
        )
    )
