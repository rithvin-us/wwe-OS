"""Document versioning is append-only: a new upload is its own StoredFile and a
new current version; the old bytes are never overwritten, and an older version
can be restored by appending a new current version that points back at it.
"""

from __future__ import annotations

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from documents.backend.services.document import DocumentService

pytestmark = pytest.mark.django_db

V1 = b"first revision of the policy"
V2 = b"second revision of the policy, corrected"


def _create(tenant, owner, **overrides):
    defaults = {
        "tenant": tenant,
        "owner": owner,
        "title": "Travel policy",
        "category": "policy",
        "data": V1,
        "filename": "policy.txt",
        "content_type": "text/plain",
        "summarize": False,
    }
    defaults.update(overrides)
    return DocumentService().create(**defaults)


def test_create_records_version_one(tenant, owner):
    document = _create(tenant, owner)

    versions = list(document.versions.all())
    assert len(versions) == 1
    assert versions[0].version == 1
    assert versions[0].is_current is True
    assert versions[0].file_id == document.file_id


def test_adding_a_version_keeps_the_old_file(tenant, owner):
    document = _create(tenant, owner)
    original_file_id = document.file_id

    DocumentService().add_version(
        document=document,
        data=V2,
        filename="policy.txt",
        content_type="text/plain",
        actor=owner,
        note="Corrected clause 4",
    )

    document.refresh_from_db()
    versions = {v.version: v for v in document.versions.all()}
    assert set(versions) == {1, 2}
    # v1's bytes are untouched and still retrievable; v2 is current.
    assert versions[1].file_id == original_file_id
    assert versions[1].is_current is False
    assert versions[2].is_current is True
    assert document.file_id == versions[2].file_id
    assert versions[1].file_id != versions[2].file_id


def test_restore_appends_a_new_current_version(tenant, owner):
    document = _create(tenant, owner)
    v1_file_id = document.file_id
    DocumentService().add_version(
        document=document, data=V2, filename="policy.txt", content_type="text/plain", actor=owner
    )

    restored = DocumentService().restore_version(document=document, version=1, actor=owner)

    document.refresh_from_db()
    assert restored.version == 3  # append-only, never rewrites history
    assert document.file_id == v1_file_id
    assert document.versions.get(version=3).is_current is True
    assert document.versions.filter(is_current=True).count() == 1


def test_checksum_and_size_come_from_the_stored_file(tenant, owner):
    document = _create(tenant, owner)
    version = document.versions.get(version=1)
    assert version.file.sha256
    assert version.file.size_bytes == len(V1)


# --------------------------------------------------------------------------- #
# HTTP surface
# --------------------------------------------------------------------------- #
def test_api_add_and_list_versions(tenant, owner, auth_client):
    document = _create(tenant, owner)
    client = auth_client(owner)

    upload = SimpleUploadedFile("policy.txt", V2, content_type="text/plain")
    post = client.post(
        f"/api/v1/documents/documents/{document.id}/versions/",
        {"file": upload, "note": "v2"},
        format="multipart",
    )
    assert post.status_code == 200, post.data
    body = post.data
    assert {row["version"] for row in body} == {1, 2}
    assert any(row["is_current"] and row["version"] == 2 for row in body)


def test_api_restore_version(tenant, owner, auth_client):
    document = _create(tenant, owner)
    DocumentService().add_version(
        document=document, data=V2, filename="policy.txt", content_type="text/plain", actor=owner
    )
    client = auth_client(owner)

    response = client.post(f"/api/v1/documents/documents/{document.id}/versions/1/restore/")

    assert response.status_code == 200, response.data
    document.refresh_from_db()
    assert document.versions.get(version=3).is_current is True


def test_api_add_version_requires_write_permission(tenant, owner, make_user, auth_client):
    document = _create(tenant, owner)
    stranger = make_user("stranger@acme.test", "stranger", tenant=tenant)
    upload = SimpleUploadedFile("policy.txt", V2, content_type="text/plain")

    response = auth_client(stranger).post(
        f"/api/v1/documents/documents/{document.id}/versions/",
        {"file": upload},
        format="multipart",
    )
    assert response.status_code == 403
