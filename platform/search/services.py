"""Search engine — permission-aware, tenant-scoped querying over documents.

Provider note: querying is PostgreSQL full-text when the database is
PostgreSQL (`SearchVector`/`SearchRank` computed on the fly — add a stored
tsvector column + GIN index when scale demands), and a portable
icontains-based rank everywhere else (sqlite tests, dev). Swapping in an
external engine later (Meilisearch/OpenSearch/Elastic) replaces the query
internals of this service; the write contract (`upsert`/`remove`/`rebuild`)
and every caller stay unchanged. A future vector/semantic extension hangs off
the same seam.
"""

from __future__ import annotations

from typing import Any

from django.db import connection, models
from shared import context
from shared.events import Events, publish
from shared.exceptions import ConflictError
from shared.services import BaseService

from search import registry
from search.models import SearchDocument

EXCERPT_WINDOW = 90


class SearchService(BaseService):
    # ------------------------------------------------------------------ #
    # Write path (modules call these from their event subscribers)
    # ------------------------------------------------------------------ #
    def upsert(
        self,
        *,
        index: str,
        doc_id: str,
        title: str,
        body: str = "",
        extra: dict[str, Any] | None = None,
        url: str = "",
        tenant=None,
    ) -> SearchDocument:
        registry.get(index)  # unregistered index = wiring bug, fail loudly
        tenant = tenant or context.current_tenant()
        if tenant is None:
            raise ConflictError("A tenant is required to index documents.")
        document, _ = SearchDocument.all_objects.update_or_create(
            tenant=tenant,
            index=index,
            doc_id=str(doc_id),
            defaults={
                "title": title[:300],
                "body": body,
                "extra": extra or {},
                "url": url,
                "is_deleted": False,
                "deleted_at": None,
            },
        )
        return document

    def remove(self, *, index: str, doc_id: str, tenant=None) -> None:
        tenant = tenant or context.current_tenant()
        SearchDocument.all_objects.filter(
            tenant=tenant, index=index, doc_id=str(doc_id)
        ).hard_delete()

    def rebuild(self, index: str, *, actor=None) -> int:
        """Re-index everything the adapter can enumerate. Synchronous by
        design (admin/management operation)."""
        adapter = registry.get(index)
        if adapter.queryset is None:
            raise ConflictError(f"Search index '{index}' does not support rebuilds.")
        count = 0
        for obj in adapter.queryset():
            doc = adapter.to_document(obj)
            self.upsert(index=index, tenant=getattr(obj, "tenant", None), **doc)
            count += 1
        publish(Events.SEARCH_REINDEXED, index=index, count=count, actor=actor)
        return count

    # ------------------------------------------------------------------ #
    # Read path
    # ------------------------------------------------------------------ #
    def search(
        self,
        *,
        user,
        query: str,
        indexes: list[str] | None = None,
        filters: dict[str, str] | None = None,
        facets: list[str] | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        allowed = self._allowed_indexes(user, indexes)
        if not allowed or not query.strip():
            return {"results": [], "meta": {"count": 0, "page": 1, "pages": 0}, "facets": {}}

        qs = SearchDocument.objects.filter(index__in=allowed)
        if not user.is_superuser:
            qs = qs.filter(tenant_id=user.tenant_id)
        for key, value in (filters or {}).items():
            qs = qs.filter(**{f"extra__{key}": value})
        qs = self._ranked(qs, query.strip())

        facet_counts: dict[str, list[dict[str, Any]]] = {}
        for key in facets or []:
            facet_counts[key] = [
                {"value": row[f"extra__{key}"], "count": row["count"]}
                for row in qs.values(f"extra__{key}")
                .annotate(count=models.Count("id"))
                .order_by("-count")[:20]
                if row[f"extra__{key}"] is not None
            ]

        total = qs.count()
        pages = (total + page_size - 1) // page_size
        start = (max(page, 1) - 1) * page_size
        rows = [
            {
                "index": doc.index,
                "doc_id": doc.doc_id,
                "title": doc.title,
                "excerpt": self._excerpt(doc, query),
                "url": doc.url,
                "extra": doc.extra,
            }
            for doc in qs[start : start + page_size]
        ]
        return {
            "results": rows,
            "meta": {"count": total, "page": page, "pages": pages},
            "facets": facet_counts,
        }

    def autocomplete(self, *, user, prefix: str, limit: int = 10) -> list[dict[str, str]]:
        allowed = self._allowed_indexes(user, None)
        if not allowed or len(prefix.strip()) < 2:
            return []
        qs = SearchDocument.objects.filter(index__in=allowed, title__istartswith=prefix.strip())
        if not user.is_superuser:
            qs = qs.filter(tenant_id=user.tenant_id)
        return [
            {"index": doc.index, "doc_id": doc.doc_id, "title": doc.title, "url": doc.url}
            for doc in qs.order_by("title")[:limit]
        ]

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    @staticmethod
    def _allowed_indexes(user, requested: list[str] | None) -> list[str]:
        names = []
        for adapter in registry.all_adapters():
            if requested and adapter.index not in requested:
                continue
            if user.is_superuser or user.has_platform_permission(adapter.permission):
                names.append(adapter.index)
        return names

    @staticmethod
    def _ranked(qs: models.QuerySet, query: str) -> models.QuerySet:
        if connection.vendor == "postgresql":
            from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector

            vector = SearchVector("title", weight="A") + SearchVector("body", weight="B")
            search_query = SearchQuery(query)
            return (
                qs.annotate(rank=SearchRank(vector, search_query))
                .filter(models.Q(rank__gt=0.01) | models.Q(title__icontains=query))
                .order_by("-rank", "-created_at")
            )
        return (
            qs.filter(models.Q(title__icontains=query) | models.Q(body__icontains=query))
            .annotate(
                rank=models.Case(
                    models.When(title__icontains=query, then=models.Value(2)),
                    default=models.Value(1),
                    output_field=models.IntegerField(),
                )
            )
            .order_by("-rank", "-created_at")
        )

    @staticmethod
    def _excerpt(doc: SearchDocument, query: str) -> str:
        body = doc.body or doc.title
        position = body.lower().find(query.lower())
        if position < 0:
            return body[: EXCERPT_WINDOW * 2].strip()
        start = max(0, position - EXCERPT_WINDOW)
        end = min(len(body), position + len(query) + EXCERPT_WINDOW)
        prefix = "…" if start > 0 else ""
        suffix = "…" if end < len(body) else ""
        return f"{prefix}{body[start:end].strip()}{suffix}"
