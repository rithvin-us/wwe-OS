from __future__ import annotations

from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.permissions import HasPlatformPermission
from shared.views import ReadOnlyModelViewSet

from audit.models import AuditLog
from audit.serializers import AuditLogSerializer


class AuditLogViewSet(ReadOnlyModelViewSet):
    """Read-only audit trail. Archive is the only mutation permitted."""

    serializer_class = AuditLogSerializer
    permission_classes = ReadOnlyModelViewSet.permission_classes + [HasPlatformPermission]
    required_permissions = {
        "list": "audit.view",
        "retrieve": "audit.view",
        "archive": "audit.archive",
    }
    search_fields = ("action", "module", "object_type", "object_id")
    ordering_fields = ("created_at", "action", "module")
    filterset_fields = {
        "module": ["exact", "in"],
        "action": ["exact"],
        "archived": ["exact"],
        "actor": ["exact"],
        # Cross-reference: every entry for one record, e.g. all activity on
        # a single purchase bill (object_type=PurchaseBill&object_id=<id>).
        "object_type": ["exact"],
        "object_id": ["exact"],
        "created_at": ["gte", "lte"],
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AuditLog.objects.none()
        user = self.request.user
        qs = AuditLog.objects.all()
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    @action(detail=True, methods=["post"])
    def archive(self, request: Request, pk=None) -> Response:
        entry = self.get_object()
        entry.archive()
        return Response({"detail": "Audit record archived."})
