"""Source identity read API — list, channel filter, permission, tenant
isolation."""

from __future__ import annotations

import pytest
from identity.models import IdentityChannel
from identity.services import IdentityService

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


def test_api_list_identities(tenant, owner, auth_client):
    IdentityService().resolve_identity(
        tenant=tenant,
        channel=IdentityChannel.TELEGRAM,
        external_id="12345",
        display_name="alice",
    )
    client = auth_client(owner)

    response = client.get("/api/v1/identity/identities/")
    assert response.status_code == 200
    rows = response.data["data"]
    assert len(rows) == 1
    assert rows[0]["external_id"] == "12345"
    assert rows[0]["display_name"] == "alice"


def test_api_filters_by_channel(tenant, owner, auth_client):
    IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="1"
    )
    IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.EMAIL, external_id="a@b.com"
    )
    client = auth_client(owner)

    response = client.get("/api/v1/identity/identities/?channel=email")
    assert response.status_code == 200
    assert [row["external_id"] for row in response.data["data"]] == ["a@b.com"]


def test_api_requires_identity_view_permission(tenant, make_user, auth_client):
    nobody = make_user(email="nobody@acme.test", username="nobody", tenant=tenant)
    client = auth_client(nobody)
    assert client.get("/api/v1/identity/identities/").status_code == 403


def test_api_tenant_isolation(
    tenant, other_tenant, owner, make_user, grant, owner_role, auth_client
):
    IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="1"
    )
    outsider = make_user(email="owner@globex.test", username="globex", tenant=other_tenant)
    grant(outsider, owner_role)
    assert auth_client(outsider).get("/api/v1/identity/identities/").data["data"] == []
