"""Storage capability tests — providers, validation, signed URLs, API."""

from __future__ import annotations

import io
import time
from pathlib import Path

import pytest
from audit.models import AuditLog
from django.core import signing
from shared.events import Events
from shared.exceptions import ValidationError
from storage.models import StoredFile
from storage.providers import DOWNLOAD_TOKEN_SALT, S3CompatibleProvider
from storage.services import StorageService, safe_filename

PDF = b"%PDF-1.4 fake but good enough"


@pytest.fixture(autouse=True)
def _storage_root(settings, tmp_path):
    settings.STORAGE_LOCAL_PATH = str(tmp_path / "objects")


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


def _store(tenant, **overrides):
    defaults = {
        "data": PDF,
        "filename": "bill.pdf",
        "content_type": "application/pdf",
        "module": "purchase",
        "tenant": tenant,
    }
    defaults.update(overrides)
    return StorageService().store(**defaults)


# --------------------------------------------------------------------------- #
# Service + local provider
# --------------------------------------------------------------------------- #


def test_store_roundtrip_with_hash_and_audit(tenant, settings):
    stored = _store(tenant)

    assert stored.key.startswith(f"t/{tenant.id}/purchase/")
    assert stored.size_bytes == len(PDF)
    assert len(stored.sha256) == 64
    assert Path(settings.STORAGE_LOCAL_PATH).joinpath(stored.key).is_file()
    assert StorageService().open(stored) == PDF
    assert AuditLog.objects.filter(action=Events.FILE_STORED, module="storage").exists()


def test_store_rejects_oversized_file(tenant, settings):
    settings.STORAGE_MAX_UPLOAD_MB = 1
    with pytest.raises(ValidationError):
        _store(tenant, data=b"x" * (1024 * 1024 + 1))


def test_store_rejects_disallowed_content_type(tenant):
    with pytest.raises(ValidationError):
        _store(tenant, content_type="application/x-msdownload", filename="virus.exe")


def test_store_rejects_empty_file(tenant):
    with pytest.raises(ValidationError):
        _store(tenant, data=b"")


def test_traversal_filenames_are_neutralized(tenant, settings):
    stored = _store(tenant, filename="..\\..\\..\\evil.pdf")
    assert ".." not in stored.key
    root = Path(settings.STORAGE_LOCAL_PATH).resolve()
    assert Path(settings.STORAGE_LOCAL_PATH).joinpath(stored.key).resolve().is_relative_to(root)


def test_safe_filename_strips_hostile_input():
    assert safe_filename("../../etc/passwd") == "passwd"
    assert safe_filename("we ird $$ name.PDF") == "we-ird-name.PDF"
    assert safe_filename("") == "file"


def test_verify_integrity_detects_corruption(tenant, settings):
    stored = _store(tenant)
    assert StorageService().verify_integrity(stored) is True

    Path(settings.STORAGE_LOCAL_PATH).joinpath(stored.key).write_bytes(b"tampered")
    assert StorageService().verify_integrity(stored) is False


def test_delete_removes_bytes_and_soft_deletes_row(tenant, settings):
    stored = _store(tenant)
    StorageService().delete(stored)

    assert not Path(settings.STORAGE_LOCAL_PATH).joinpath(stored.key).exists()
    assert StoredFile.objects.filter(id=stored.id).count() == 0
    assert StoredFile.all_objects.filter(id=stored.id).count() == 1
    assert AuditLog.objects.filter(action=Events.FILE_DELETED, module="storage").exists()


# --------------------------------------------------------------------------- #
# Signed URLs
# --------------------------------------------------------------------------- #


def test_signed_url_downloads_without_auth(tenant, api):
    stored = _store(tenant)
    url = StorageService().signed_url(stored)

    response = api.get(url)
    assert response.status_code == 200
    assert response.content == PDF
    assert stored.filename in response["Content-Disposition"]


def test_signed_url_rejects_tampered_token(tenant, api):
    stored = _store(tenant)
    url = StorageService().signed_url(stored)
    assert api.get(url + "x").status_code == 403


def test_signed_url_rejects_expired_token(tenant, api):
    stored = _store(tenant)
    token = signing.dumps(
        {"key": stored.key, "exp": int(time.time()) - 10}, salt=DOWNLOAD_TOKEN_SALT
    )
    assert api.get(f"/api/v1/storage/download/?token={token}").status_code == 403


# --------------------------------------------------------------------------- #
# S3-compatible provider (stub client)
# --------------------------------------------------------------------------- #


class StubS3Client:
    def __init__(self):
        self.calls: list[tuple[str, dict]] = []

    def put_object(self, **kwargs):
        self.calls.append(("put", kwargs))

    def get_object(self, **kwargs):
        self.calls.append(("get", kwargs))
        return {"Body": io.BytesIO(b"remote-bytes")}

    def delete_object(self, **kwargs):
        self.calls.append(("delete", kwargs))

    def generate_presigned_url(self, operation, Params, ExpiresIn):  # noqa: N803
        self.calls.append(("presign", {"op": operation, **Params, "expires": ExpiresIn}))
        return f"https://r2.example/{Params['Key']}"


def test_s3_provider_delegates_to_client(settings):
    settings.STORAGE_S3_BUCKET = "wweos"
    stub = StubS3Client()
    provider = S3CompatibleProvider(client=stub)

    provider.put("t/x/doc.pdf", b"abc", "application/pdf")
    assert provider.get("t/x/doc.pdf") == b"remote-bytes"
    provider.delete("t/x/doc.pdf")
    url = provider.signed_url("t/x/doc.pdf", expires_seconds=300, filename="doc.pdf")

    assert url == "https://r2.example/t/x/doc.pdf"
    ops = [op for op, _ in stub.calls]
    assert ops == ["put", "get", "delete", "presign"]
    put_kwargs = stub.calls[0][1]
    assert put_kwargs["Bucket"] == "wweos"
    assert put_kwargs["ContentType"] == "application/pdf"


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #


def test_api_upload_list_download(tenant, owner, auth_client):
    client = auth_client(owner)
    upload = io.BytesIO(PDF)
    upload.name = "invoice.pdf"

    created = client.post(
        "/api/v1/storage/files/",
        {"file": upload, "module": "purchase", "category": "bill"},
        format="multipart",
    )
    assert created.status_code == 201
    file_id = created.data["id"]

    listed = client.get("/api/v1/storage/files/")
    assert [row["id"] for row in listed.data["data"]] == [file_id]

    downloaded = client.get(f"/api/v1/storage/files/{file_id}/download/")
    assert downloaded.status_code == 200
    assert downloaded.content == PDF

    url_response = client.get(f"/api/v1/storage/files/{file_id}/url/")
    assert url_response.status_code == 200
    assert "token=" in url_response.data["url"]


def test_api_requires_storage_permissions(tenant, make_user, auth_client):
    nobody = make_user(email="nobody@acme.test", username="nobody", tenant=tenant)
    upload = io.BytesIO(PDF)
    upload.name = "invoice.pdf"

    client = auth_client(nobody)
    assert client.get("/api/v1/storage/files/").status_code == 403
    assert (
        client.post(
            "/api/v1/storage/files/",
            {"file": upload, "module": "purchase"},
            format="multipart",
        ).status_code
        == 403
    )


def test_api_tenant_isolation(
    tenant, other_tenant, owner, make_user, grant, owner_role, auth_client
):
    _store(tenant)

    outsider = make_user(email="owner@globex.test", username="globex", tenant=other_tenant)
    grant(outsider, owner_role)
    assert auth_client(outsider).get("/api/v1/storage/files/").data["data"] == []
