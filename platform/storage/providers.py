"""Object storage providers.

`StorageProvider` is the contract every backend implements. The service layer
— and therefore every module — talks only to this interface, so switching
Cloudflare R2 → AWS S3 → MinIO is configuration, not a code change (all three
speak the S3 API through `S3CompatibleProvider`). Azure Blob / GCS get their
own provider class later without touching any caller.

Local development and tests use `LocalStorageProvider`: bytes on disk under
STORAGE_LOCAL_PATH, "signed URLs" served by the platform's own download
endpoint with a Django-signed, expiring token.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, ClassVar
from urllib.parse import quote

from django.conf import settings
from django.core import signing
from django.core.exceptions import ImproperlyConfigured
from shared.exceptions import NotFoundError, ValidationError

DOWNLOAD_TOKEN_SALT = "storage.download"


class StorageProvider(ABC):
    """Every method deals in opaque keys; key layout is the service's job."""

    supports_versioning: ClassVar[bool] = False

    @abstractmethod
    def put(self, key: str, data: bytes, content_type: str) -> None: ...

    @abstractmethod
    def get(self, key: str) -> bytes: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...

    @abstractmethod
    def exists(self, key: str) -> bool: ...

    @abstractmethod
    def signed_url(self, key: str, *, expires_seconds: int, filename: str = "") -> str: ...


class LocalStorageProvider(StorageProvider):
    """Filesystem-backed provider for development and tests."""

    def __init__(self, root: str | Path | None = None) -> None:
        self.root = Path(root or settings.STORAGE_LOCAL_PATH).resolve()

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValidationError("Invalid storage key.")
        return path

    def put(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, key: str) -> bytes:
        path = self._path(key)
        if not path.is_file():
            raise NotFoundError("Stored object not found.")
        return path.read_bytes()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def signed_url(self, key: str, *, expires_seconds: int, filename: str = "") -> str:
        token = signing.dumps(
            {"key": key, "exp": int(time.time()) + expires_seconds},
            salt=DOWNLOAD_TOKEN_SALT,
        )
        return f"/api/v1/storage/download/?token={quote(token)}"


class S3CompatibleProvider(StorageProvider):
    """Cloudflare R2 / AWS S3 / MinIO — anything speaking the S3 API.

    boto3 is imported lazily so it stays an optional dependency until an
    S3-compatible backend is actually configured (STORAGE_BACKEND=s3).
    Versioning is a bucket-level setting on the provider side; when enabled
    there, old versions are retained on overwrite/delete automatically.
    """

    supports_versioning = True

    def __init__(self, *, client: Any = None) -> None:
        if client is not None:
            self.client = client  # tests inject a stub
        else:
            try:
                import boto3
                from botocore.config import Config
            except ImportError as exc:  # pragma: no cover - environment-specific
                raise ImproperlyConfigured(
                    "STORAGE_BACKEND=s3 requires boto3 (pip install boto3)."
                ) from exc
            self.client = boto3.client(
                "s3",
                endpoint_url=settings.STORAGE_S3_ENDPOINT_URL or None,
                region_name=settings.STORAGE_S3_REGION or None,
                aws_access_key_id=settings.STORAGE_S3_ACCESS_KEY_ID,
                aws_secret_access_key=settings.STORAGE_S3_SECRET_ACCESS_KEY,
                # R2's cert only covers *.r2.cloudflarestorage.com (one level) —
                # boto3's default virtual-hosted addressing puts the bucket as
                # a second subdomain level (bucket.account.r2.cloudflarestorage.com),
                # which R2 rejects at the TLS handshake. Path-style keeps the
                # bucket in the URL path instead.
                config=Config(s3={"addressing_style": "path"}),
            )
        self.bucket = settings.STORAGE_S3_BUCKET

    def put(self, key: str, data: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def get(self, key: str) -> bytes:
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
        except Exception as exc:
            raise NotFoundError("Stored object not found.") from exc
        return response["Body"].read()

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
        except Exception:
            return False
        return True

    def signed_url(self, key: str, *, expires_seconds: int, filename: str = "") -> str:
        params: dict[str, str] = {"Bucket": self.bucket, "Key": key}
        if filename:
            params["ResponseContentDisposition"] = f'attachment; filename="{filename}"'
        return self.client.generate_presigned_url(
            "get_object", Params=params, ExpiresIn=expires_seconds
        )


def get_provider() -> StorageProvider:
    backend = settings.STORAGE_BACKEND
    if backend in ("s3", "r2", "minio"):
        return S3CompatibleProvider()
    if backend == "local":
        return LocalStorageProvider()
    raise ImproperlyConfigured(f"Unknown STORAGE_BACKEND '{backend}'.")
