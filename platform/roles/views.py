from __future__ import annotations

from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.exceptions import NotFoundError
from shared.views import BaseModelViewSet
from users.models import User

from roles.models import Role
from roles.serializers import (
    AssignRoleSerializer,
    RoleSerializer,
    SetPermissionsSerializer,
)
from roles.services import RoleService


class RoleViewSet(BaseModelViewSet):
    serializer_class = RoleSerializer
    search_fields = ("name", "slug")
    ordering_fields = ("name", "created_at")
    required_permissions = {
        "list": "roles.read",
        "retrieve": "roles.read",
        "create": "roles.manage",
        "update": "roles.manage",
        "partial_update": "roles.manage",
        "destroy": "roles.manage",
        "set_permissions": "roles.manage",
        "assign": "roles.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Role.objects.none()
        user = self.request.user
        qs = Role.objects.all()
        if user.is_superuser:
            return qs
        # A tenant sees its own roles plus the shared system roles.
        return qs.filter(tenant__isnull=True) | qs.filter(tenant_id=user.tenant_id)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)

    @action(detail=True, methods=["put"], url_path="permissions")
    def set_permissions(self, request: Request, pk=None) -> Response:
        role = self.get_object()
        data = SetPermissionsSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        RoleService().set_permissions(role, data.validated_data["permission_codes"])
        return Response(RoleSerializer(role).data)

    @action(detail=True, methods=["post"])
    def assign(self, request: Request, pk=None) -> Response:
        role = self.get_object()
        data = AssignRoleSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        target = User.objects.filter(id=data.validated_data["user_id"]).first()
        if target is None:
            raise NotFoundError("User not found.")
        RoleService().assign_role(user=target, role=role, assigned_by=request.user)
        return Response({"detail": "Role assigned."})
