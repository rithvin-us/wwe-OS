from __future__ import annotations

from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.exceptions import NotFoundError
from shared.views import BaseModelViewSet
from users.models import User

from notifications.models import Notification, Status
from notifications.serializers import (
    NotificationCreateSerializer,
    NotificationSerializer,
)
from notifications.services import NotificationService


class NotificationViewSet(BaseModelViewSet):
    """A recipient reads and manages their own notifications.

    Sending to others requires `notifications.send`.
    """

    serializer_class = NotificationSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    search_fields = ("title", "body", "category")
    ordering_fields = ("created_at", "priority")
    filterset_fields = ("status", "category", "priority", "channel")
    required_permissions = {"create": "notifications.send"}

    def get_queryset(self):
        # Users only ever see their own notifications.
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        return Notification.objects.filter(recipient=self.request.user)

    def create(self, request: Request, *args, **kwargs) -> Response:
        data = NotificationCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        payload = data.validated_data
        recipient = User.objects.filter(id=payload.pop("recipient")).first()
        # Never send across tenants — treat an out-of-tenant recipient as
        # not-found so the sender learns nothing about other tenants' users.
        if recipient is None or (
            not request.user.is_superuser and recipient.tenant_id != request.user.tenant_id
        ):
            raise NotFoundError("Recipient not found.")
        notification = NotificationService().create(recipient=recipient, **payload)
        return Response(NotificationSerializer(notification).data, status=201)

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request: Request, pk=None) -> Response:
        notification = self.get_object()
        NotificationService().mark_read(notification)
        return Response(NotificationSerializer(notification).data)

    @action(detail=True, methods=["post"], url_path="archive")
    def mark_archived(self, request: Request, pk=None) -> Response:
        notification = self.get_object()
        NotificationService().mark_archived(notification)
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request: Request) -> Response:
        count = self.get_queryset().filter(status=Status.UNREAD).count()
        return Response({"unread": count})

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request: Request) -> Response:
        updated = NotificationService().mark_all_read(request.user)
        return Response({"updated": updated})
