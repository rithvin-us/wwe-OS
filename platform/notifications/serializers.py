from __future__ import annotations

from rest_framework import serializers

from notifications.models import Notification, PushSubscription


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "recipient",
            "category",
            "priority",
            "channel",
            "status",
            "title",
            "body",
            "data",
            "read_at",
            "created_at",
        )
        read_only_fields = ("id", "status", "read_at", "created_at")


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
