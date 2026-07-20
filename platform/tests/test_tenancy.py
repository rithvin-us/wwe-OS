from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db


def test_users_are_isolated_per_tenant(
    make_user, tenant, other_tenant, auth_client, grant, owner_role
):
    owner = make_user(email="owner@acme.test", username="owner_a", tenant=tenant)
    grant(owner, owner_role)
    make_user(email="peer@acme.test", username="peer_a", tenant=tenant)
    make_user(email="outsider@globex.test", username="outsider_b", tenant=other_tenant)

    resp = auth_client(owner).get("/api/v1/users/")
    assert resp.status_code == 200
    emails = {row["email"] for row in resp.json()["data"]}
    assert "peer@acme.test" in emails
    assert "outsider@globex.test" not in emails


def test_company_profile_is_scoped_to_caller_tenant(
    make_user, tenant, auth_client, grant, owner_role
):
    owner = make_user(tenant=tenant)
    grant(owner, owner_role)
    resp = auth_client(owner).get("/api/v1/tenancy/company-profile/")
    assert resp.status_code == 200
    assert resp.json()["data"]["tenant"] == str(tenant.id)
