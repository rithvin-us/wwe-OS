"""Source identity read API."""

from __future__ import annotations

from shared.views import ReadOnlyModelViewSet

from identity.models import SourceIdentity
from identity.serializers import SourceIdentitySerializer


class SourceIdentityViewSet(ReadOnlyModelViewSet):
    serializer_class = SourceIdentitySerializer
    filterset_fields = ("channel",)
    ordering_fields = ("last_seen_at", "created_at")
    required_permissions = {"default": "identity.view"}

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return SourceIdentity.objects.none()
        user = self.request.user
        qs = SourceIdentity.objects.order_by("-last_seen_at")
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs
