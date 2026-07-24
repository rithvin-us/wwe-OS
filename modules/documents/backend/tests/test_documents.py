"""Documents module tests — the full platform-integration surface.

Proves the module reuses (never reimplements) storage, AI, workflow, search,
reporting, notifications, and audit.
"""

from __future__ import annotations

import pytest
from audit.models import AuditLog
from django.core.files.uploadedfile import SimpleUploadedFile
from documents.backend.models import Document, DocumentStatus, SummaryStatus
from documents.backend.services.document import DocumentService
from search.services import SearchService
from storage.models import StoredFile

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/documents/documents/"
TEXT = b"This is the quarterly policy on travel reimbursement. Employees may claim..."


def _upload(client, title="Travel policy", category="policy", content=TEXT, name="policy.txt"):
    return client.post(
        LIST_URL,
        {
            "file": SimpleUploadedFile(name, content, content_type="text/plain"),
            "title": title,
            "category": category,
            "description": "Company travel reimbursement policy.",
            "tags": ["hr", "travel"],
        },
        format="multipart",
    )


def _create(tenant, owner, **overrides):
    defaults = {
        "tenant": tenant,
        "owner": owner,
        "title": "Travel policy",
        "category": "policy",
        "data": TEXT,
        "filename": "policy.txt",
        "content_type": "text/plain",
    }
    defaults.update(overrides)
    return DocumentService().create(**defaults)


# --------------------------------------------------------------------------- #
# Create — storage + AI + search + audit in one path
# --------------------------------------------------------------------------- #


def test_create_stores_summarizes_and_indexes(tenant, owner):
    document = _create(tenant, owner)

    # Storage: bytes went to a StoredFile, not the module.
    assert isinstance(document.file, StoredFile)
    assert document.file.module == "documents"
    assert StorageService_open(document) == TEXT

    # AI: summary came from the gateway (mock provider in tests).
    assert document.summary_status == SummaryStatus.READY
    assert document.ai_summary.startswith("[mock:")

    # Audit: the create event was recorded.
    assert AuditLog.objects.filter(action="documents.created", module="documents").exists()

    # Search: the document is findable by the owner.
    results = SearchService().search(user=owner, query="travel")
    assert any(r["doc_id"] == str(document.id) for r in results["results"])


def StorageService_open(document):
    from storage.services import StorageService

    return StorageService().open(document.file)


def test_create_rejects_disallowed_file_type(tenant, owner):
    from shared.exceptions import ValidationError

    with pytest.raises(ValidationError):
        _create(tenant, owner, content_type="application/x-msdownload", filename="x.exe")


# --------------------------------------------------------------------------- #
# Lifecycle
# --------------------------------------------------------------------------- #


def test_archive_removes_from_search(tenant, owner):
    document = _create(tenant, owner)
    assert SearchService().search(user=owner, query="travel")["results"]

    DocumentService().archive(document=document, actor=owner)
    document.refresh_from_db()
    assert document.status == DocumentStatus.ARCHIVED
    assert SearchService().search(user=owner, query="travel")["results"] == []


def test_delete_removes_bytes_and_soft_deletes(tenant, owner):
    document = _create(tenant, owner)
    file_id = document.file_id
    DocumentService().delete(document=document, actor=owner)

    assert Document.objects.filter(id=document.id).count() == 0
    assert Document.all_objects.filter(id=document.id).count() == 1
    assert StoredFile.objects.filter(id=file_id).count() == 0  # soft-deleted


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #


def test_api_upload_list_download(tenant, owner, auth_client):
    client = auth_client(owner)
    created = _upload(client)
    assert created.status_code == 201
    document_id = created.data["id"]
    assert created.data["summary_status"] == "ready"
    assert created.data["file_name"].endswith(".txt")

    listed = client.get(LIST_URL)
    assert [row["id"] for row in listed.data["data"]] == [document_id]

    download = client.get(f"{LIST_URL}{document_id}/download/")
    assert download.status_code == 200
    assert download.content == TEXT


def test_api_export_renders_report(tenant, owner, auth_client):
    _create(tenant, owner)
    response = auth_client(owner).post(f"{LIST_URL}export/", {"format": "csv"}, format="json")
    assert response.status_code == 200
    assert response["Content-Type"] == "text/csv"
    assert b"Travel policy" in response.content


def test_api_permissions_enforced(tenant, owner, make_user, auth_client):
    _create(tenant, owner)
    nobody = make_user("nobody@acme.test", "nobody", tenant=tenant)
    client = auth_client(nobody)

    assert client.get(LIST_URL).status_code == 403
    assert _upload(client).status_code == 403


def test_api_tenant_isolation(tenant, other_tenant, owner, make_user, auth_client):
    _create(tenant, owner)
    from roles.models import Role
    from roles.services import RoleService

    outsider = make_user("owner@globex.test", "globex", tenant=other_tenant)
    RoleService().assign_role(user=outsider, role=Role.objects.get(slug="owner"))
    assert auth_client(outsider).get(LIST_URL).data["data"] == []


# --------------------------------------------------------------------------- #
# Tags (through the platform tagging capability, not a local JSONField)
# --------------------------------------------------------------------------- #


def test_create_with_tags_creates_real_tag_relations(tenant, owner):
    from tagging.models import Tag

    document = _create(tenant, owner, tags=["Auditor", "Monthly"])

    names = {t.name for t in DocumentService().tags_for(document)}
    assert names == {"Auditor", "Monthly"}
    assert Tag.objects.filter(tenant=tenant, name__in=["Auditor", "Monthly"]).count() == 2


def test_api_document_serializes_tags_as_objects(tenant, owner, auth_client):
    document = _create(tenant, owner, tags=["Urgent"])
    response = auth_client(owner).get(f"{LIST_URL}{document.id}/")
    assert response.status_code == 200
    assert response.data["tags"][0]["name"] == "Urgent"
    assert "color" in response.data["tags"][0]


def test_update_metadata_replaces_tags(tenant, owner):
    document = _create(tenant, owner, tags=["Urgent"])
    DocumentService().update_metadata(document=document, actor=owner, tags=["Paid"])
    names = {t.name for t in DocumentService().tags_for(document)}
    assert names == {"Paid"}


# --------------------------------------------------------------------------- #
# Business periods (platform/periods integration)
# --------------------------------------------------------------------------- #


def test_create_files_document_into_a_human_readable_period_path(tenant, owner):
    from datetime import date

    document = _create(tenant, owner, category="policy")

    today = date.today()
    month_name = today.strftime("%B")
    expected_prefix = f"{tenant.slug}/{today.year}/{month_name}/Policies/"
    assert document.file.key.startswith(expected_prefix)
    assert document.file.period_year == today.year
    assert document.file.period_month == today.month
    assert document.file.category == "policy"


def test_create_updates_the_periods_manifest(tenant, owner):
    from datetime import date

    from periods.models import BusinessPeriod

    _create(tenant, owner, category="policy")

    today = date.today()
    period = BusinessPeriod.objects.get(tenant=tenant, year=today.year, month=today.month)
    assert period.manifest.document_counts == {"policy": 1}
    assert period.manifest.total_count == 1


# --------------------------------------------------------------------------- #
# Source identity (platform/identity integration)
# --------------------------------------------------------------------------- #


def test_create_resolves_a_manual_identity_for_the_owner(tenant, owner):
    from identity.models import IdentityChannel, SourceIdentity

    _create(tenant, owner)

    identity = SourceIdentity.objects.get(
        tenant=tenant, channel=IdentityChannel.MANUAL, external_id=str(owner.id)
    )
    assert identity.display_name == owner.email


def test_create_without_an_owner_skips_identity_resolution(tenant):
    from identity.models import SourceIdentity

    _create(tenant, None)

    assert SourceIdentity.objects.count() == 0
