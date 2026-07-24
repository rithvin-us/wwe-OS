"""Source identity read API serializers."""

from __future__ import annotations

from shared.serializers import BaseModelSerializer

from identity.models import SourceIdentity


class SourceIdentitySerializer(BaseModelSerializer):
    class Meta:
        model = SourceIdentity
        fields = (
            "id",
            "channel",
            "external_id",
            "display_name",
            "mapped_module",
            "mapped_object_type",
            "mapped_object_id",
            "last_seen_at",
            "created_at",
        )
        read_only_fields = fields
