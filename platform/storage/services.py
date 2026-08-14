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

from storage.content import looks_executable, matches_declared_type
from storage.models import ScanStatus, StoredFile
from storage.providers import get_provider

_FILENAME_SAFE_RE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(filename: str) -> str:
    """Keep only the base name with a conservative character set."""
    base = PurePosixPath(filename.replace("\\", "/")).name or "file"
    cleaned = _FILENAME_SAFE_RE.sub("-", base).strip("-.") or "file"
    return cleaned[:120]


_MAX_DEDUPE_ATTEMPTS = 100


def _dedupe_key(key: str) -> str:
    """A human-readable key (from platform/periods) must stay unique
    against StoredFile.key's DB constraint. Append a numeric suffix before
    the extension on collision — "-2", "-3", ... — rather than the opaque
    UUID prefix the auto-generated key path uses, so the tree stays
    readable. Bounded to avoid looping forever on a pathological input."""
    if not StoredFile.objects.filter(key=key).exists():
        return key
    path = PurePosixPath(key)
    stem, suffix = path.stem, path.suffix
    for attempt in range(2, _MAX_DEDUPE_ATTEMPTS + 2):
        candidate = str(path.with_name(f"{stem}-{attempt}{suffix}"))
        if not StoredFile.objects.filter(key=candidate).exists():
            return candidate
    raise ConflictError(f"Could not find a unique storage key for '{key}'.")


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
        key: str | None = None,
        period_year: int | None = None,
        period_month: int | None = None,
        is_library: bool = False,
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

        # Extension and declared MIME are caller-controlled and spoofable, so
        # the allow-list check above is necessary but not sufficient. Inspect
        # the actual bytes: refuse executables outright and require the content
        # to back up its declared type when we can fingerprint it. Toggleable
        # for the rare backend that must accept opaque bytes.
        if getattr(settings, "STORAGE_VERIFY_CONTENT", True):
            if looks_executable(data):
                raise ValidationError(
                    detail={"file": ["Executable files cannot be uploaded."]}
                )
            if not matches_declared_type(data, content_type):
                raise ValidationError(
                    detail={
                        "file": [
                            f"File content does not match the declared type '{content_type}'."
                        ]
                    }
                )

        name = safe_filename(filename)
        digest = hashlib.sha256(data).hexdigest()
        if key is None:
            stamp = timezone.now().strftime("%Y/%m")
            final_key = f"t/{tenant.id}/{module}/{stamp}/{uuid.uuid4().hex[:12]}-{name}"
        else:
            final_key = _dedupe_key(key)

        get_provider().put(final_key, data, content_type)
        stored = StoredFile.objects.create(
            tenant=tenant,
            key=final_key,
            filename=name,
            content_type=content_type,
            size_bytes=len(data),
            sha256=digest,
            module=module,
            category=category,
            metadata=metadata or {},
            uploaded_by=uploaded_by,
            scan_status=ScanStatus.SKIPPED,
            period_year=period_year,
            period_month=period_month,
            is_library=is_library,
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
