"""Tagging capability tests — service, API, permissions, tenant isolation,
audit-on-mutation."""

from __future__ import annotations

import pytest
from audit.models import AuditLog
from shared.events import Events
from shared.exceptions import ConflictError, ValidationError
from tagging.models import Tag, TaggedItem
from tagging.services import TagService

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/tags/"
FOR_OBJECT_URL = "/api/v1/tags/for-object/"


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


# --------------------------------------------------------------------------- #
# Service
# --------------------------------------------------------------------------- #


def test_create_tag(tenant):
    tag = TagService().create_tag(tenant=tenant, name="Urgent", color="rose")
    assert tag.name == "Urgent"
    assert tag.color == "rose"
    assert AuditLog.objects.filter(action=Events.TAG_CREATED, module="tagging").exists()


def test_create_tag_rejects_duplicate_name_case_insensitively(tenant):
    TagService().create_tag(tenant=tenant, name="Urgent")
    with pytest.raises(ConflictError):
        TagService().create_tag(tenant=tenant, name="urgent")


def test_create_tag_rejects_blank_name(tenant):
    with pytest.raises(ValidationError):
        TagService().create_tag(tenant=tenant, name="   ")


def test_get_or_create_tag_reuses_existing(tenant):
    first = TagService().create_tag(tenant=tenant, name="GST")
    reused = TagService().get_or_create_tag(tenant=tenant, name="gst")
    assert reused.id == first.id


def test_update_tag_renames_and_recolors(tenant):
    tag = TagService().create_tag(tenant=tenant, name="Paid", color="blue")
    updated = TagService().update_tag(tag=tag, name="Fully Paid", color="green")
    assert updated.name == "Fully Paid"
    assert updated.color == "green"


def test_delete_tag_cascades_tagged_items(tenant):
    tag = TagService().create_tag(tenant=tenant, name="Cash")
    TagService().set_tags_for_object(
        tenant=tenant,
        module="purchase",
        object_type="PurchaseBill",
        object_id="1",
        tag_ids=[str(tag.id)],
    )
    TagService().delete_tag(tag=tag)
    assert TaggedItem.objects.count() == 0
    assert AuditLog.objects.filter(action=Events.TAG_DELETED).exists()


def test_set_tags_for_object_replaces_the_full_set(tenant):
    urgent = TagService().create_tag(tenant=tenant, name="Urgent")
    paid = TagService().create_tag(tenant=tenant, name="Paid")
    ref = {"tenant": tenant, "module": "purchase", "object_type": "PurchaseBill", "object_id": "42"}

    TagService().set_tags_for_object(**ref, tag_ids=[str(urgent.id), str(paid.id)])
    assert {
        t.name
        for t in TagService().tags_for_object(
            tenant=tenant, module="purchase", object_type="PurchaseBill", object_id="42"
        )
    } == {"Urgent", "Paid"}

    # Replacing with just one tag drops the other.
    TagService().set_tags_for_object(**ref, tag_ids=[str(paid.id)])
    remaining = TagService().tags_for_object(
        tenant=tenant, module="purchase", object_type="PurchaseBill", object_id="42"
    )
    assert [t.name for t in remaining] == ["Paid"]
    assert AuditLog.objects.filter(action=Events.TAG_ATTACHED).exists()
    assert AuditLog.objects.filter(action=Events.TAG_DETACHED).exists()


def test_set_tags_for_object_creates_tags_by_name(tenant):
    TagService().set_tags_for_object(
        tenant=tenant,
        module="documents",
        object_type="Document",
        object_id="7",
        tag_names=["Auditor", "Monthly"],
    )
    assert Tag.objects.filter(tenant=tenant, name__in=["Auditor", "Monthly"]).count() == 2


def test_set_tags_for_object_clears_all_tags_when_given_none(tenant):
    tag = TagService().create_tag(tenant=tenant, name="Office")
    ref = {"tenant": tenant, "module": "assets", "object_type": "Asset", "object_id": "5"}
    TagService().set_tags_for_object(**ref, tag_ids=[str(tag.id)])
    TagService().set_tags_for_object(**ref)
    assert TaggedItem.objects.filter(module="assets", object_id="5").count() == 0


def test_analytics_counts_usage(tenant):
    tag = TagService().create_tag(tenant=tenant, name="Project A")
    TagService().set_tags_for_object(
        tenant=tenant,
        module="purchase",
        object_type="PurchaseBill",
        object_id="1",
        tag_ids=[str(tag.id)],
    )
    TagService().set_tags_for_object(
        tenant=tenant,
        module="purchase",
        object_type="PurchaseBill",
        object_id="2",
        tag_ids=[str(tag.id)],
    )
    rows = TagService().analytics(tenant=tenant)
    assert rows[0]["name"] == "Project A"
    assert rows[0]["usage_count"] == 2


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #


def test_api_create_list_recolor_delete(tenant, owner, auth_client):
    client = auth_client(owner)

    created = client.post(LIST_URL, {"name": "Hardware", "color": "amber"}, format="json")
    assert created.status_code == 201
    tag_id = created.data["id"]

    listed = client.get(LIST_URL)
    assert [row["name"] for row in listed.data["data"]] == ["Hardware"]

    recolored = client.patch(f"{LIST_URL}{tag_id}/", {"color": "green"}, format="json")
    assert recolored.status_code == 200
    assert recolored.data["color"] == "green"

    deleted = client.delete(f"{LIST_URL}{tag_id}/")
    assert deleted.status_code == 204
    assert Tag.objects.count() == 0


def test_api_for_object_get_and_put(tenant, owner, auth_client):
    client = auth_client(owner)
    client.post(LIST_URL, {"name": "Construction"}, format="json")
    tag_id = Tag.objects.get(name="Construction").id

    put = client.put(
        FOR_OBJECT_URL,
        {
            "module": "purchase",
            "object_type": "PurchaseBill",
            "object_id": "100",
            "tag_ids": [str(tag_id)],
        },
        format="json",
    )
    assert put.status_code == 200
    assert [row["name"] for row in put.data] == ["Construction"]

    got = client.get(
        FOR_OBJECT_URL,
        {"module": "purchase", "object_type": "PurchaseBill", "object_id": "100"},
    )
    assert got.status_code == 200
    assert [row["name"] for row in got.data] == ["Construction"]


def test_api_requires_tags_permissions(tenant, make_user, auth_client):
    nobody = make_user(email="nobody@acme.test", username="nobody", tenant=tenant)
    client = auth_client(nobody)
    assert client.get(LIST_URL).status_code == 403
    assert client.post(LIST_URL, {"name": "X"}, format="json").status_code == 403


def test_tags_are_isolated_per_tenant(tenant, other_tenant, owner):
    TagService().create_tag(tenant=tenant, name="Shared Name")
    TagService().create_tag(tenant=other_tenant, name="Shared Name")
    assert Tag.objects.filter(tenant=tenant).count() == 1
    assert Tag.objects.filter(tenant=other_tenant).count() == 1
