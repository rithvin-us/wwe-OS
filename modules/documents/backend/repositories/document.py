"""Document data access.

Thin by design — the tenant-scoped, soft-delete-aware manager on the model
does the heavy lifting; this layer names the few queries the service needs so
the service never inlines ORM filters. Mirrors the purchase module's
repository layer.
"""

from __future__ import annotations

from django.db import models
from documents.backend.models import Document, DocumentStatus


class DocumentRepository:
    def for_tenant(self, tenant) -> models.QuerySet[Document]:
        return Document.objects.filter(tenant=tenant)

    def get(self, *, document_id, tenant) -> Document | None:
        return Document.objects.filter(id=document_id, tenant=tenant).first()

    def summarizable(self, tenant) -> models.QuerySet[Document]:
        return self.for_tenant(tenant).exclude(status=DocumentStatus.ARCHIVED)
