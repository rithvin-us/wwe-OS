"""Search index storage.

One row per searchable business object, denormalized to platform vocabulary:
an index name, a document id, title/body text, and opaque `extra` filter
fields. Modules own what goes in; the platform owns querying. This is the
PostgreSQL-backed provider's table — an external engine (Meilisearch,
OpenSearch) would replace the query path, not the write contract.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class SearchDocument(TenantOwnedModel):
    index = models.CharField(max_length=50)
    doc_id = models.CharField(max_length=64)
    title = models.CharField(max_length=300)
    body = models.TextField(blank=True, default="")
    extra = models.JSONField(default=dict, blank=True)
    url = models.CharField(
        max_length=300,
        blank=True,
        default="",
        help_text="Frontend route for this result, e.g. /purchases/bills/<id>.",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "search_document"
        indexes = [models.Index(fields=["tenant", "index"])]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "index", "doc_id"], name="uniq_search_doc_per_index"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.index}:{self.doc_id} — {self.title[:40]}"
