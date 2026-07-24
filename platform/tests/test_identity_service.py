"""IdentityService — resolve/map, audited via the existing AuditService,
same per-app subscriber pattern as storage/subscribers.py."""

from __future__ import annotations

import pytest
from audit.models import AuditLog
from identity.models import IdentityChannel, SourceIdentity
from identity.services import IdentityService
from shared.events import Events

pytestmark = pytest.mark.django_db


def test_resolve_identity_creates_on_first_sight(tenant):
    identity = IdentityService().resolve_identity(
        tenant=tenant,
        channel=IdentityChannel.TELEGRAM,
        external_id="12345",
        display_name="alice",
    )
    assert identity.channel == IdentityChannel.TELEGRAM
    assert identity.external_id == "12345"
    assert identity.display_name == "alice"
    assert SourceIdentity.objects.count() == 1


def test_resolve_identity_is_idempotent(tenant):
    first = IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="12345"
    )
    second = IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="12345"
    )
    assert first.id == second.id
    assert SourceIdentity.objects.count() == 1


def test_resolve_identity_updates_display_name_but_never_channel_or_external_id(tenant):
    first = IdentityService().resolve_identity(
        tenant=tenant,
        channel=IdentityChannel.TELEGRAM,
        external_id="12345",
        display_name="old_name",
    )
    updated = IdentityService().resolve_identity(
        tenant=tenant,
        channel=IdentityChannel.TELEGRAM,
        external_id="12345",
        display_name="new_name",
    )
    assert updated.id == first.id
    assert updated.display_name == "new_name"
    assert updated.channel == IdentityChannel.TELEGRAM
    assert updated.external_id == "12345"


def test_identity_resolved_event_fires_once_not_on_repeat(tenant):
    IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="1"
    )
    IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="1"
    )
    IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="1"
    )

    assert AuditLog.objects.filter(action=Events.IDENTITY_RESOLVED, module="identity").count() == 1


def test_map_to_sets_target_and_publishes_every_call(tenant):
    identity = IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="12345"
    )

    IdentityService().map_to(
        identity=identity, module="purchase", object_type="Vendor", object_id="v-1"
    )
    IdentityService().map_to(
        identity=identity, module="purchase", object_type="Vendor", object_id="v-2"
    )

    identity.refresh_from_db()
    assert identity.mapped_module == "purchase"
    assert identity.mapped_object_type == "Vendor"
    assert identity.mapped_object_id == "v-2"
    assert AuditLog.objects.filter(action=Events.IDENTITY_MAPPED, module="identity").count() == 2


def test_list_identities_is_tenant_scoped(tenant, other_tenant):
    IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="1"
    )
    IdentityService().resolve_identity(
        tenant=other_tenant, channel=IdentityChannel.TELEGRAM, external_id="2"
    )

    identities = IdentityService().list_identities(tenant=tenant)
    assert [i.external_id for i in identities] == ["1"]


def test_list_identities_filters_by_channel(tenant):
    IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="1"
    )
    IdentityService().resolve_identity(
        tenant=tenant, channel=IdentityChannel.EMAIL, external_id="a@b.com"
    )

    identities = IdentityService().list_identities(tenant=tenant, channel=IdentityChannel.EMAIL)
    assert [i.external_id for i in identities] == ["a@b.com"]
