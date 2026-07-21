"""Settings endpoints — self-profile (any user) and company basics (settings perms)."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db

ME_PROFILE = "/api/v1/users/me/profile/"
CURRENT_TENANT = "/api/v1/tenancy/current/"


# --------------------------------------------------------------------------- #
# Self-profile — a baseline capability, no platform permission required
# --------------------------------------------------------------------------- #


def test_user_edits_own_profile_without_admin_permission(make_user, tenant, auth_client):
    user = make_user(email="me@acme.test", username="me", tenant=tenant)  # no roles
    client = auth_client(user)

    read = client.get(ME_PROFILE)
    assert read.status_code == 200
    assert read.data["username"] == "me"

    resp = client.patch(ME_PROFILE, {"phone": "+15551234", "timezone": "Europe/London"})
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.phone == "+15551234"
    assert user.timezone == "Europe/London"


def test_self_profile_cannot_change_identity(make_user, tenant, auth_client):
    user = make_user(email="me@acme.test", username="me", tenant=tenant)
    resp = auth_client(user).patch(ME_PROFILE, {"username": "hacker", "email": "x@y.test"})
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.username == "me"  # read-only fields ignored
    assert user.email == "me@acme.test"


def test_self_profile_requires_auth(api):
    assert api.get(ME_PROFILE).status_code == 401


# --------------------------------------------------------------------------- #
# Company basics — settings.view to read, settings.manage to edit
# --------------------------------------------------------------------------- #


def test_owner_edits_company_basics(make_user, tenant, owner_role, grant, auth_client):
    owner = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(owner, owner_role)

    resp = auth_client(owner).patch(CURRENT_TENANT, {"name": "Acme Ltd", "currency": "GBP"})
    assert resp.status_code == 200
    tenant.refresh_from_db()
    assert tenant.name == "Acme Ltd"
    assert tenant.currency == "GBP"


def test_company_edit_requires_manage(make_user, tenant, make_role, grant, auth_client):
    viewer = make_user(email="v@acme.test", username="viewer", tenant=tenant)
    grant(viewer, make_role(tenant, "viewer", ["settings.view"]))  # can view, not manage
    client = auth_client(viewer)

    assert client.get(CURRENT_TENANT).status_code == 200
    assert client.patch(CURRENT_TENANT, {"name": "Nope"}).status_code == 403
