from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db


def test_liveness(api):
    resp = api.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "ok"


def test_readiness(api):
    resp = api.get("/readyz")
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "ready"


def test_unauthenticated_requests_are_rejected(api):
    assert api.get("/api/v1/users/").status_code == 401


def test_openapi_schema_generates(make_user, tenant, auth_client, grant, owner_role):
    user = make_user(tenant=tenant)
    grant(user, owner_role)
    resp = auth_client(user).get("/api/v1/schema/")
    assert resp.status_code == 200


def test_permission_catalog_is_readable(make_user, tenant, auth_client, grant, owner_role):
    user = make_user(tenant=tenant)
    grant(user, owner_role)
    resp = auth_client(user).get("/api/v1/permissions/")
    assert resp.status_code == 200
    assert resp.json()["meta"]["count"] >= 13
