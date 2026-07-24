"""SourceIdentity model — uniqueness, tenant isolation."""

from __future__ import annotations

import pytest
from django.db import IntegrityError
from identity.models import IdentityChannel, SourceIdentity

pytestmark = pytest.mark.django_db


def test_channel_and_external_id_unique_per_tenant(tenant):
    SourceIdentity.objects.create(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="12345"
    )
    with pytest.raises(IntegrityError):
        SourceIdentity.objects.create(
            tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="12345"
        )


def test_two_tenants_same_channel_and_external_id_do_not_collide(tenant, other_tenant):
    SourceIdentity.objects.create(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="12345"
    )
    SourceIdentity.objects.create(
        tenant=other_tenant, channel=IdentityChannel.TELEGRAM, external_id="12345"
    )
    assert (
        SourceIdentity.objects.filter(channel=IdentityChannel.TELEGRAM, external_id="12345").count()
        == 2
    )


def test_different_channels_same_external_id_do_not_collide(tenant):
    SourceIdentity.objects.create(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="same"
    )
    SourceIdentity.objects.create(tenant=tenant, channel=IdentityChannel.EMAIL, external_id="same")
    assert SourceIdentity.objects.filter(tenant=tenant, external_id="same").count() == 2
