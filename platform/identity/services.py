"""IdentityService — the single entry point every ingestion channel calls
to resolve a trusted source identity. See design §2a/§2c:
docs/superpowers/specs/2026-07-24-identity-service-design.md
"""

from __future__ import annotations

from shared.events import Events, publish
from shared.services import BaseService

from identity.models import SourceIdentity


class IdentityService(BaseService):
    def resolve_identity(
        self, *, tenant, channel: str, external_id: str, display_name: str = ""
    ) -> SourceIdentity:
        identity, created = SourceIdentity.objects.get_or_create(
            tenant=tenant,
            channel=channel,
            external_id=external_id,
            defaults={"display_name": display_name},
        )
        if created:
            publish(Events.IDENTITY_RESOLVED, instance=identity)
        elif display_name and display_name != identity.display_name:
            identity.display_name = display_name
            identity.save(update_fields=["display_name", "last_seen_at", "updated_at"])
        else:
            identity.save(update_fields=["last_seen_at", "updated_at"])
        return identity

    def map_to(
        self, *, identity: SourceIdentity, module: str, object_type: str, object_id: str
    ) -> SourceIdentity:
        identity.mapped_module = module
        identity.mapped_object_type = object_type
        identity.mapped_object_id = str(object_id)
        identity.save(
            update_fields=["mapped_module", "mapped_object_type", "mapped_object_id", "updated_at"]
        )
        publish(Events.IDENTITY_MAPPED, instance=identity)
        return identity

    def list_identities(self, *, tenant, channel: str | None = None) -> list[SourceIdentity]:
        qs = SourceIdentity.objects.filter(tenant=tenant)
        if channel:
            qs = qs.filter(channel=channel)
        return list(qs.order_by("-last_seen_at"))
