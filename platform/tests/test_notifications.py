from __future__ import annotations

from unittest.mock import patch

import httpx
import pytest
from notifications.models import Channel
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


def test_read_all_clears_every_unread(make_user, tenant, auth_client):
    user = make_user(tenant=tenant)
    service = NotificationService()
    service.create(recipient=user, title="One")
    service.create(recipient=user, title="Two")
    client = auth_client(user)
    assert client.get("/api/v1/notifications/unread-count/").json()["data"]["unread"] == 2

    resp = client.post("/api/v1/notifications/read-all/")
    assert resp.status_code == 200
    assert resp.json()["data"]["updated"] == 2
    assert client.get("/api/v1/notifications/unread-count/").json()["data"]["unread"] == 0


def test_cannot_send_across_tenants(
    make_user, tenant, other_tenant, auth_client, grant, owner_role
):
    sender = make_user(email="s@acme.test", username="sender", tenant=tenant)
    grant(sender, owner_role)  # can send within their tenant
    outsider = make_user(email="r@globex.test", username="outsider", tenant=other_tenant)

    payload = {"recipient": str(outsider.id), "title": "Hi"}
    resp = auth_client(sender).post("/api/v1/notifications/", payload, format="json")
    assert resp.status_code == 404  # cross-tenant recipient is hidden


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


def test_telegram_not_configured_skips_silently(make_user, tenant, settings):
    settings.TELEGRAM_BOT_TOKEN = ""
    settings.TELEGRAM_ALERT_CHAT_ID = ""
    user = make_user(tenant=tenant)

    with patch("notifications.services.httpx.post") as mock_post:
        NotificationService().create(recipient=user, title="Ping", channel=Channel.TELEGRAM)

    mock_post.assert_not_called()


def test_telegram_configured_sends_message(make_user, tenant, settings):
    settings.TELEGRAM_BOT_TOKEN = "test-token"
    settings.TELEGRAM_ALERT_CHAT_ID = "12345"
    user = make_user(tenant=tenant)

    with patch("notifications.services.httpx.post") as mock_post:
        mock_post.return_value.raise_for_status.return_value = None
        NotificationService().create(
            recipient=user,
            title="Pending bills",
            body="₹1,200 pending",
            channel=Channel.TELEGRAM,
        )

    mock_post.assert_called_once()
    _, kwargs = mock_post.call_args
    assert mock_post.call_args[0][0] == "https://api.telegram.org/bottest-token/sendMessage"
    assert kwargs["json"]["chat_id"] == "12345"
    assert "Pending bills" in kwargs["json"]["text"]


def test_telegram_delivery_failure_does_not_raise(make_user, tenant, settings):
    settings.TELEGRAM_BOT_TOKEN = "test-token"
    settings.TELEGRAM_ALERT_CHAT_ID = "12345"
    user = make_user(tenant=tenant)

    with patch("notifications.services.httpx.post", side_effect=httpx.ConnectError("network down")):
        # Must not raise — a delivery failure never breaks the caller.
        NotificationService().create(recipient=user, title="Ping", channel=Channel.TELEGRAM)
