from __future__ import annotations

from django.conf import settings
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.exceptions import NotFoundError
from shared.views import BaseModelViewSet
from tenancy.services import TenancyService
from users.models import User

from notifications.models import Notification, PushSubscription, Status
from notifications.serializers import (
    NotificationCreateSerializer,
    NotificationSerializer,
    PushSubscribeSerializer,
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

    @action(detail=False, methods=["get"], url_path="push/vapid-public-key")
    def vapid_public_key(self, request: Request) -> Response:
        return Response({"key": settings.VAPID_PUBLIC_KEY or None})

    @action(detail=False, methods=["post"], url_path="push/subscribe")
    def push_subscribe(self, request: Request) -> Response:
        data = PushSubscribeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        # A superuser created without a tenant (the bootstrap operator
        # account) has no `.tenant` — resolve the single-operator default
        # the same way the AI gateway does rather than failing every
        # subscribe from that account.
        tenant = request.user.tenant or TenancyService().resolve_existing_default_tenant()
        # all_objects: `endpoint` is unique across tenants, not scoped to
        # one — look it up unscoped so re-subscribing never races the
        # tenant-scoped manager into inserting a duplicate.
        # Reset is_deleted/deleted_at explicitly — this row may be a prior
        # soft-deleted unsubscribe of the same endpoint (see delete() below).
        PushSubscription.all_objects.update_or_create(
            endpoint=v["endpoint"],
            defaults={
                "recipient": request.user,
                "tenant": tenant,
                "p256dh_key": v["keys"]["p256dh"],
                "auth_key": v["keys"]["auth"],
                "user_agent": request.META.get("HTTP_USER_AGENT", "")[:300],
                "is_deleted": False,
                "deleted_at": None,
            },
        )
        return Response({"subscribed": True}, status=201)

    @action(detail=False, methods=["post"], url_path="push/unsubscribe")
    def push_unsubscribe(self, request: Request) -> Response:
        endpoint = request.data.get("endpoint", "")
        # QuerySet.delete() is soft-delete platform-wide (shared/models.py) —
        # it returns the updated row count, not Django's default
        # (count, {model: count}) tuple.
        updated = PushSubscription.objects.filter(
            recipient=request.user, endpoint=endpoint
        ).delete()
        return Response({"unsubscribed": updated > 0})
