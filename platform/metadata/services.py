"""MetadataService — a live read that unifies universal StoredFile fields,
a registered module extractor's business fields, and tags into one shape.
Never cached (design §2b):
docs/superpowers/specs/2026-07-25-metadata-engine-design.md
"""

from __future__ import annotations

from typing import Any

from shared.exceptions import NotFoundError
from shared.services import BaseService
from storage.models import StoredFile
from tagging.services import TagService

from metadata.registry import try_get_metadata_provider


class MetadataService(BaseService):
    def get_metadata(self, *, stored_file: StoredFile, tenant) -> dict[str, Any]:
        if stored_file.tenant_id != tenant.id:
            raise NotFoundError("No such file for this tenant.")

        fields = {
            "storage_location": stored_file.key,
            "hash": stored_file.sha256,
            "size_bytes": stored_file.size_bytes,
            "content_type": stored_file.content_type,
            "document_type": stored_file.category,
            "period_year": stored_file.period_year,
            "period_month": stored_file.period_month,
            "is_library": stored_file.is_library,
            "created_at": stored_file.created_at,
            "updated_at": stored_file.updated_at,
            "uploaded_by": stored_file.uploaded_by_id,
            "title": "",
            "status": "",
            "extra": {},
            "tags": [],
        }

        provider = try_get_metadata_provider(stored_file.module)
        business = provider.extract(stored_file) if provider else None
        if business is None:
            return fields

        fields["title"] = business.title
        fields["status"] = business.status
        fields["extra"] = business.extra
        fields["tags"] = list(
            TagService()
            .tags_for_object(
                tenant=tenant,
                module=stored_file.module,
                object_type=business.business_object_type,
                object_id=business.business_object_id,
            )
            .values_list("name", flat=True)
        )
        return fields
