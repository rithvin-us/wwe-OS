from __future__ import annotations

from rest_framework.decorators import action
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from shared.views import BaseModelViewSet

from users.models import User
from users.serializers import MeProfileSerializer, UserCreateSerializer, UserSerializer


class MeProfileView(RetrieveUpdateAPIView):
    """Any authenticated user reads and edits their OWN profile — this is a
    baseline capability, not an admin action, so it needs no platform
    permission (unlike UserViewSet, which manages other people)."""

    serializer_class = MeProfileSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self) -> User:
        return self.request.user


class UserViewSet(BaseModelViewSet):
    """Manage platform users. Tenant-scoped for tenant admins."""

    serializer_class = UserSerializer
    search_fields = ("username", "email", "phone")
    ordering_fields = ("created_at", "username", "email")
    filterset_fields = ("status", "is_active", "tenant")
    required_permissions = {
        "list": "users.read",
        "retrieve": "users.read",
        "me": "users.read",
        "create": "users.write",
        "update": "users.write",
        "partial_update": "users.write",
        "destroy": "users.write",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        qs = User.objects.all()
        user = self.request.user
        # Non-superusers only ever see users within their own tenant.
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def perform_create(self, serializer) -> None:
        # A non-superuser can only ever create users inside their own tenant —
        # any `tenant` in the request body is overridden, not trusted.
        user = self.request.user
        if user.is_superuser:
            serializer.save()
        else:
            serializer.save(tenant=user.tenant)

    @action(detail=False, methods=["get"])
    def me(self, request: Request) -> Response:
        return Response(UserSerializer(request.user).data)
