from __future__ import annotations

from rest_framework import serializers

from notifications.classification import bucket_for
from notifications.models import Notification, PushSubscription


class NotificationSerializer(serializers.ModelSerializer):
    bucket = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "recipient",
            "category",
            "priority",
            "bucket",
            "channel",
            "status",
            "title",
            "body",
            "data",
            "read_at",
            "created_at",
        )
        read_only_fields = ("id", "status", "read_at", "created_at")

    def get_bucket(self, obj: Notification) -> str:
        """The operator-facing category (critical / action required /
        informational / completed) the Notification Center groups by."""
        return bucket_for(priority=obj.priority, data=obj.data)


class NotificationCreateSerializer(serializers.Serializer):
    recipient = serializers.UUIDField()
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(required=False, allow_blank=True, default="")
    category = serializers.CharField(required=False, default="general")
    priority = serializers.ChoiceField(
        choices=["low", "normal", "high", "urgent"], default="normal"
    )
    channel = serializers.ChoiceField(
        choices=["in_app", "email", "telegram", "webhook"], default="in_app"
    )
    data = serializers.DictField(required=False, default=dict)


class PushSubscriptionKeysSerializer(serializers.Serializer):
    p256dh = serializers.CharField(max_length=200)
    auth = serializers.CharField(max_length=100)


class PushSubscribeSerializer(serializers.Serializer):
    """Mirrors the browser's `PushSubscription.toJSON()` shape exactly, so
    the frontend can POST the object it gets back from
    `pushManager.subscribe()` without reshaping it."""

    endpoint = serializers.URLField(max_length=500)
    keys = PushSubscriptionKeysSerializer()


class PushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushSubscription
        fields = ("id", "endpoint", "created_at")
        read_only_fields = fields
