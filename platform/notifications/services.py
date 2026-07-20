from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from shared.events import Events, publish
from shared.services import BaseService

from notifications.models import Channel, Notification, Status

logger = logging.getLogger("platform.notifications")


class NotificationService(BaseService):
    def create(
        self,
        *,
        recipient,
        title: str,
        body: str = "",
        category: str = "general",
        priority: str = "normal",
        channel: str = Channel.IN_APP,
        data: dict[str, Any] | None = None,
        tenant=None,
    ) -> Notification:
        notification = Notification.objects.create(
            recipient=recipient,
            tenant=tenant or getattr(recipient, "tenant", None),
            title=title,
            body=body,
            category=category,
            priority=priority,
            channel=channel,
            data=data or {},
        )
        self._dispatch(notification)
        publish(Events.NOTIFICATION_CREATED, instance=notification, actor=None)
        return notification

    def _dispatch(self, notification: Notification) -> None:
        """In-app is stored (nothing more to do). Email sends now; Telegram and
        webhooks are wired by their services later."""
        if notification.channel == Channel.EMAIL and notification.recipient.email:
            send_mail(
                subject=notification.title,
                message=notification.body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[notification.recipient.email],
                fail_silently=True,
            )
        elif notification.channel in (Channel.TELEGRAM, Channel.WEBHOOK):
            logger.info(
                "Notification %s queued for %s channel (delivery service pending).",
                notification.id,
                notification.channel,
            )

    def mark_read(self, notification: Notification) -> Notification:
        notification.status = Status.READ
        notification.read_at = timezone.now()
        notification.save(update_fields=["status", "read_at", "updated_at"])
        return notification

    def mark_archived(self, notification: Notification) -> Notification:
        notification.status = Status.ARCHIVED
        notification.save(update_fields=["status", "updated_at"])
        return notification
