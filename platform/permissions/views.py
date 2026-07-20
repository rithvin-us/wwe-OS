from rest_framework.permissions import IsAuthenticated
from shared.permissions import HasPlatformPermission
from shared.views import ReadOnlyModelViewSet

from permissions.models import Permission
from permissions.serializers import PermissionSerializer


class PermissionViewSet(ReadOnlyModelViewSet):
    """The permission catalog — read-only; permissions are defined in code."""

    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "permissions.read"
    search_fields = ("code", "name", "category")
    ordering_fields = ("category", "code")
    filterset_fields = ("category",)
