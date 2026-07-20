from __future__ import annotations

import pytest
from notifications.services import NotificationService

pytestmark = pytest.mark.django_db


def test_recipient_sees_own_notifications(make_user, tenant, auth_client):
    user = make_user(tenant=tenant)
    NotificationService().create(recipient=user, title="Welcome", body="Hello")

    client = auth_client(user)
    listing = client.get("/api/v1/notifications/")
    assert listing.status_code == 200
    assert len(listing.json()["data"]) == 1
    assert client.get("/api/v1/notifications/unread-count/").json()["data"]["unread"] == 1


def test_mark_read_clears_unread(make_user, tenant, auth_client):
    user = make_user(tenant=tenant)
    note = NotificationService().create(recipient=user, title="Ping")
    client = auth_client(user)
    resp = client.post(f"/api/v1/notifications/{note.id}/read/")
    assert resp.status_code == 200
    assert client.get("/api/v1/notifications/unread-count/").json()["data"]["unread"] == 0


def test_sending_requires_permission(
    make_user, tenant, auth_client, grant, member_role, owner_role
):
    sender = make_user(email="s@acme.test", username="sender", tenant=tenant)
    recipient = make_user(email="r@acme.test", username="recipient", tenant=tenant)
    payload = {"recipient": str(recipient.id), "title": "Hi"}

    grant(sender, member_role)  # no notifications.send
    assert (
        auth_client(sender).post("/api/v1/notifications/", payload, format="json").status_code
        == 403
    )

    grant(sender, owner_role)  # owner can send
    assert (
        auth_client(sender).post("/api/v1/notifications/", payload, format="json").status_code
        == 201
    )
