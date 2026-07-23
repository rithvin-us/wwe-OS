"""Document business logic.

Orchestrates platform capabilities; owns none of them:

- Storage  — the file bytes go to `StorageService` (local/R2/S3).
- AI       — summaries come from the `AIService` gateway via a registered prompt.
- Workflow — approvals run on the platform `WorkflowService`.
- Search   — every mutation re-indexes through `SearchService`.
- Reporting— exports render through `ReportService`.
- Notify   — the owner is told of outcomes via `NotificationService`.
- Audit    — events on the shared bus are recorded by the audit subscriber.

The module never talks to a storage/AI/search provider directly and never
reimplements any of the above.
"""

from __future__ import annotations

from typing import Any

from documents.backend.events.registry import (
    DOCUMENT_ARCHIVED,
    DOCUMENT_CREATED,
    DOCUMENT_SUMMARIZED,
    DOCUMENT_UPDATED,
)
from documents.backend.models import Document, DocumentStatus, SummaryStatus
from documents.backend.search.adapter import INDEX, to_document
from search.services import SearchService
from shared.events import publish
from shared.exceptions import ConflictError, ValidationError
from shared.services import BaseService
from storage.services import StorageService
from tagging.services import TagService

WORKFLOW_KEY = "document-approval"
TEXT_CONTENT_TYPES = ("text/plain", "text/csv", "text/html", "application/json")
SUMMARY_INPUT_LIMIT = 6000
TAG_MODULE = "documents"
TAG_OBJECT_TYPE = "Document"


class DocumentService(BaseService):
    # ------------------------------------------------------------------ #
    # Create / update
    # ------------------------------------------------------------------ #
    def create(
        self,
        *,
        tenant,
        owner,
        title: str,
        category: str,
        data: bytes,
        filename: str,
        content_type: str,
        description: str = "",
        tags: list[str] | None = None,
        summarize: bool = True,
    ) -> Document:
        stored = StorageService().store(
            data=data,
            filename=filename,
            content_type=content_type,
            module="documents",
            category="document",
            tenant=tenant,
            uploaded_by=owner,
            metadata={"title": title},
        )
        document = Document.objects.create(
            tenant=tenant,
            owner=owner,
            title=title.strip(),
            category=category,
            description=description.strip(),
            file=stored,
        )
        if tags:
            self.set_tags(document=document, tag_names=tags)
        publish(DOCUMENT_CREATED, instance=document, actor=owner)
        self._index(document)
        if summarize:
            self.generate_summary(document)
        return document

    def update_metadata(
        self,
        *,
        document: Document,
        actor,
        title: str | None = None,
        category: str | None = None,
        description: str | None = None,
        tags: list[str] | None = None,
    ) -> Document:
        if document.status == DocumentStatus.ARCHIVED:
            raise ConflictError("An archived document cannot be edited.")
        fields: list[str] = []
        for field, value in (
            ("title", title.strip() if title is not None else None),
            ("category", category),
            ("description", description.strip() if description is not None else None),
        ):
            if value is not None and getattr(document, field) != value:
                setattr(document, field, value)
                fields.append(field)
        if fields:
            document.save(update_fields=[*fields, "updated_at"])
        if tags is not None:
            self.set_tags(document=document, tag_names=tags)
        if fields or tags is not None:
            publish(DOCUMENT_UPDATED, instance=document, actor=actor)
            self._index(document)
        return document

    # ------------------------------------------------------------------ #
    # AI summary (through the platform gateway)
    # ------------------------------------------------------------------ #
    def generate_summary(self, document: Document) -> Document:
        """Best-effort: a failed summary never blocks the document. Text-like
        files are summarized from their content; everything else is summarized
        from its title + description (honest — no fake OCR here, that is the
        ingestion pipeline's job)."""
        from ai.services import AIService

        try:
            result = AIService().generate(
                module="documents",
                prompt_key="documents-summary",
                variables={"title": document.title, "content": self._summary_input(document)},
                tenant=document.tenant,
                requested_by=document.owner,
                use_case="documents-summary",
            )
            document.ai_summary = result.text
            document.summary_status = SummaryStatus.READY
        except Exception:  # noqa: BLE001 - summary is optional, never fatal
            document.summary_status = SummaryStatus.FAILED
            self.logger.exception("Document summary failed for %s", document.id)
        document.save(update_fields=["ai_summary", "summary_status", "updated_at"])
        if document.summary_status == SummaryStatus.READY:
            publish(DOCUMENT_SUMMARIZED, instance=document, actor=document.owner)
            self._index(document)
        return document

    def _summary_input(self, document: Document) -> str:
        if document.file.content_type in TEXT_CONTENT_TYPES:
            try:
                text = StorageService().open(document.file).decode("utf-8", errors="ignore")
                if text.strip():
                    return text[:SUMMARY_INPUT_LIMIT]
            except Exception:  # noqa: BLE001 - fall back to metadata
                self.logger.warning("Could not read document %s for summary", document.id)
        return (document.description or document.title)[:SUMMARY_INPUT_LIMIT]

    # ------------------------------------------------------------------ #
    # Lifecycle
    # ------------------------------------------------------------------ #
    def archive(self, *, document: Document, actor) -> Document:
        document.status = DocumentStatus.ARCHIVED
        document.save(update_fields=["status", "updated_at"])
        publish(DOCUMENT_ARCHIVED, instance=document, actor=actor)
        SearchService().remove(index=INDEX, doc_id=str(document.id), tenant=document.tenant)
        return document

    def delete(self, *, document: Document, actor) -> None:
        """Hard-removes the bytes (via storage) and soft-deletes the record."""
        SearchService().remove(index=INDEX, doc_id=str(document.id), tenant=document.tenant)
        StorageService().delete(document.file, actor=actor)
        document.delete()  # soft delete — audit still knows it existed

    # ------------------------------------------------------------------ #
    # Tags (through the platform tagging capability — see platform/tagging)
    # ------------------------------------------------------------------ #
    def set_tags(self, *, document: Document, tag_names: list[str]):
        return TagService().set_tags_for_object(
            tenant=document.tenant,
            module=TAG_MODULE,
            object_type=TAG_OBJECT_TYPE,
            object_id=str(document.id),
            tag_names=tag_names,
        )

    def tags_for(self, document: Document):
        return TagService().tags_for_object(
            tenant=document.tenant,
            module=TAG_MODULE,
            object_type=TAG_OBJECT_TYPE,
            object_id=str(document.id),
        )

    # ------------------------------------------------------------------ #
    # Reporting (through the platform reporting engine)
    # ------------------------------------------------------------------ #
    def build_report_spec(self, *, documents, filters: dict | None = None) -> Any:
        from reporting.filtering import filters_summary
        from reporting.spec import ReportColumn, ReportSpec

        rows = [
            {
                "title": doc.title,
                "category": doc.get_category_display(),
                "status": doc.get_status_display(),
                "owner": doc.owner.email if doc.owner else "",
                "created": doc.created_at.strftime("%Y-%m-%d"),
            }
            for doc in documents
        ]
        return ReportSpec(
            key="documents-register",
            title="Document register",
            module="documents",
            columns=[
                ReportColumn("title", "Title"),
                ReportColumn("category", "Category"),
                ReportColumn("status", "Status"),
                ReportColumn("owner", "Owner"),
                ReportColumn("created", "Created", align="right"),
            ],
            rows=rows,
            filters=filters_summary(filters or {}),
        )

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    def _index(self, document: Document) -> None:
        if document.status == DocumentStatus.ARCHIVED:
            return
        doc = to_document(document)
        SearchService().upsert(index=INDEX, tenant=document.tenant, **doc)


def validate_tags(tags: Any) -> list[str]:
    if not isinstance(tags, list) or any(not isinstance(tag, str) for tag in tags):
        raise ValidationError(detail={"tags": ["Tags must be a list of strings."]})
    return [tag.strip() for tag in tags if tag.strip()][:20]
