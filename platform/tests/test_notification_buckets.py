"""The Notification Center groups notifications into four operator-facing
buckets derived deterministically from priority, with an explicit data.kind
override. The bucket rides along on the serialized notification.
"""

from __future__ import annotations

import pytest
from notifications.classification import (
    ACTION_REQUIRED,
    COMPLETED,
    CRITICAL,
    INFORMATIONAL,
    bucket_for,
)
from notifications.services import NotificationService

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ("priority", "expected"),
    [
        ("urgent", CRITICAL),
        ("high", ACTION_REQUIRED),
        ("normal", INFORMATIONAL),
        ("low", COMPLETED),
        ("unknown", INFORMATIONAL),
    ],
)
def test_priority_maps_to_bucket(priority, expected):
    assert bucket_for(priority=priority) == expected


def test_data_kind_overrides_priority():
    # A low-priority notice a module explicitly marks as action-required wins.
    assert bucket_for(priority="low", data={"kind": ACTION_REQUIRED}) == ACTION_REQUIRED


def test_invalid_data_kind_is_ignored():
    assert bucket_for(priority="urgent", data={"kind": "banana"}) == CRITICAL


def test_serialized_notification_carries_its_bucket(make_user, tenant, auth_client):
    user = make_user(tenant=tenant)
    NotificationService().create(recipient=user, title="Renewal due", priority="high")

    client = auth_client(user)
    row = client.get("/api/v1/notifications/").json()["data"][0]

    assert row["bucket"] == ACTION_REQUIRED
