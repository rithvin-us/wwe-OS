"""Storage business rules: validation, tenant-namespaced keys, integrity.

Modules never touch a provider. They call `StorageService.store(...)` with
bytes and get back a `StoredFile`; everything else (size/MIME validation,
hashing, key layout, provider selection, events) is the platform's problem.
"""

from __future__ import annotations

import hashlib
import re
import uuid
from pathlib import PurePosixPath
from typing import Any

from django.conf import settings
from django.utils import timezone
from shared import context
from shared.events import Events, publish
from shared.exceptions import ConflictError, ValidationError
from shared.services import BaseService

from storage.models import ScanStatus, StoredFile
from storage.providers import get_provider

_FILENAME_SAFE_RE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(filename: str) -> str:
    """Keep only the base name with a conservative character set."""
    base = PurePosixPath(filename.replace("\\", "/")).name or "file"
    cleaned = _FILENAME_SAFE_RE.sub("-", base).strip("-.") or "file"
    return cleaned[:120]


class StorageService(BaseService):
    def store(
        self,
        *,
        data: bytes,
        filename: str,
        content_type: str,
        module: str,
        tenant=None,
        uploaded_by=None,
        category: str = "",
        metadata: dict[str, Any] | None = None,
        max_size_bytes: int | None = None,
        allowed_types: set[str] | None = None,
    ) -> StoredFile:
        tenant = tenant or context.current_tenant()
        if tenant is None:
            raise ConflictError("A tenant is required to store files.")

        limit = max_size_bytes or settings.STORAGE_MAX_UPLOAD_MB * 1024 * 1024
        if not data:
            raise ValidationError(detail={"file": ["The file is empty."]})
        if len(data) > limit:
            raise ValidationError(
                detail={"file": [f"File exceeds the {limit // (1024 * 1024)} MB size limit."]}
            )
        permitted = allowed_types or settings.STORAGE_ALLOWED_TYPES
        if content_type not in permitted:
            raise ValidationError(
                detail={"file": [f"Content type '{content_type}' is not allowed."]}
            )

        name = safe_filename(filename)
        digest = hashlib.sha256(data).hexdigest()
        key = f"t/{tenant.id}/{module}/{timezone.now():%Y/%m}/{uuid.uuid4().hex[:12]}-{name}"

        get_provider().put(key, data, content_type)
        stored = StoredFile.objects.create(
            tenant=tenant,
            key=key,
            filename=name,
            content_type=content_type,
            size_bytes=len(data),
            sha256=digest,
            module=module,
            category=category,
            metadata=metadata or {},
            uploaded_by=uploaded_by,
            scan_status=ScanStatus.SKIPPED,
        )
        publish(Events.FILE_STORED, instance=stored, actor=uploaded_by)
        return stored

    def open(self, stored: StoredFile) -> bytes:
        return get_provider().get(stored.key)

    def signed_url(self, stored: StoredFile, *, expires_seconds: int = 600) -> str:
        return get_provider().signed_url(
            stored.key, expires_seconds=expires_seconds, filename=stored.filename
        )

    def delete(self, stored: StoredFile, *, actor=None) -> None:
        """Removes the bytes from the provider and soft-deletes the metadata
        row — the audit trail keeps knowing the file existed."""
        get_provider().delete(stored.key)
        stored.delete()
        publish(Events.FILE_DELETED, instance=stored, actor=actor)

    def verify_integrity(self, stored: StoredFile) -> bool:
        return hashlib.sha256(get_provider().get(stored.key)).hexdigest() == stored.sha256

    def mark_scan_result(self, stored: StoredFile, status: str) -> StoredFile:
        if status not in ScanStatus.values:
            raise ValidationError(detail={"scan_status": ["Unknown scan status."]})
        stored.scan_status = status
        stored.save(update_fields=["scan_status", "updated_at"])
        return stored
