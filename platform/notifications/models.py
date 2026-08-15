"""Generic notification engine. Business meaning comes from callers; this
stores and routes messages. In-app and email work now; Telegram and webhooks
are declared channels wired by their services later.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class Channel(models.TextChoices):
    IN_APP = "in_app", "In-app"
    EMAIL = "email", "Email"
    TELEGRAM = "telegram", "Telegram"
    WEBHOOK = "webhook", "Webhook"


class Priority(models.TextChoices):
    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"


class Status(models.TextChoices):
    UNREAD = "unread", "Unread"
    READ = "read", "Read"
    ARCHIVED = "archived", "Archived"


class Notification(TenantOwnedModel):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    category = models.CharField(max_length=100, default="general", db_index=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    channel = models.CharField(max_length=10, choices=Channel.choices, default=Channel.IN_APP)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.UNREAD, db_index=True
    )
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    data = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "notifications_notification"
        indexes = [models.Index(fields=["recipient", "status"])]


class PushSubscription(TenantOwnedModel):
    """A browser's Web Push subscription (one per device/browser a user has
    granted notification permission on). Every Notification, regardless of
    its own `channel`, also fans out to every push subscription its
    recipient has — push is a delivery surface, not something callers opt
    into per notification."""

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions"
    )
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh_key = models.CharField(max_length=200)
    auth_key = models.CharField(max_length=100)
    user_agent = models.CharField(max_length=300, blank=True, default="")

    class Meta(TenantOwnedModel.Meta):
        db_table = "notifications_push_subscription"
        indexes = [models.Index(fields=["recipient"])]
