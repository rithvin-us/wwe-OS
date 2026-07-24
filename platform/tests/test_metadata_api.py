"""Unified metadata read API — single-object endpoint, permission,
tenant isolation."""

from __future__ import annotations

import pytest
from metadata.registry import MetadataFields, MetadataProviderDef, register_metadata_provider
from storage.services import StorageService

pytestmark = pytest.mark.django_db

PDF = b"%PDF-1.4 fake but good enough"


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


@pytest.fixture(autouse=True)
def _register_test_provider():
    def extract(stored_file):
        return MetadataFields(
            title="Fake Bill",
            status="processed",
            business_object_type="FakeBill",
            business_object_id="fb-1",
        )

    register_metadata_provider(MetadataProviderDef(module="test.metadata.api", extract=extract))


def _store(tenant, **overrides):
    defaults = {
        "data": PDF,
        "filename": "bill.pdf",
        "content_type": "application/pdf",
        "module": "test.metadata.api",
        "category": "invoice",
        "tenant": tenant,
    }
    defaults.update(overrides)
    return StorageService().store(**defaults)


def test_api_returns_merged_metadata(tenant, owner, auth_client):
    stored = _store(tenant)
    client = auth_client(owner)

    response = client.get(f"/api/v1/metadata/files/{stored.id}/")
    assert response.status_code == 200
    assert response.data["title"] == "Fake Bill"
    assert response.data["storage_location"] == stored.key
    assert response.data["hash"] == stored.sha256


def test_api_requires_metadata_view_permission(tenant, make_user, auth_client):
    stored = _store(tenant)
    nobody = make_user(email="nobody@acme.test", username="nobody", tenant=tenant)
    client = auth_client(nobody)

    assert client.get(f"/api/v1/metadata/files/{stored.id}/").status_code == 403


def test_api_404s_for_another_tenants_file(
    tenant, other_tenant, make_user, grant, owner_role, auth_client
):
    stored = _store(tenant)
    outsider = make_user(email="owner@globex.test", username="globex", tenant=other_tenant)
    grant(outsider, owner_role)

    response = auth_client(outsider).get(f"/api/v1/metadata/files/{stored.id}/")
    assert response.status_code == 404


def test_api_404s_for_unknown_file_id(tenant, owner, auth_client):
    import uuid

    client = auth_client(owner)
    response = client.get(f"/api/v1/metadata/files/{uuid.uuid4()}/")
    assert response.status_code == 404
