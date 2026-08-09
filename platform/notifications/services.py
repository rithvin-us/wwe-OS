from __future__ import annotations

import logging
from typing import Any

import httpx
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
        """In-app is stored (nothing more to do). Email and Telegram send now;
        webhooks are wired by their service later."""
        if notification.channel == Channel.EMAIL and notification.recipient.email:
            send_mail(
                subject=notification.title,
                message=notification.body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[notification.recipient.email],
                fail_silently=True,
            )
        elif notification.channel == Channel.TELEGRAM:
            self._send_telegram(notification)
        elif notification.channel == Channel.WEBHOOK:
            logger.info(
                "Notification %s queued for %s channel (delivery service pending).",
                notification.id,
                notification.channel,
            )

    def _send_telegram(self, notification: Notification) -> None:
        """Best-effort outbound send — mirrors email's `fail_silently=True`,
        a delivery failure never breaks the caller that created the
        notification. Single fixed chat id (see settings.py) — the
        single-operator model has exactly one Telegram destination, not a
        per-recipient mapping."""
        token = settings.TELEGRAM_BOT_TOKEN
        chat_id = settings.TELEGRAM_ALERT_CHAT_ID
        if not token or not chat_id:
            logger.info(
                "Notification %s not sent — Telegram isn't configured "
                "(TELEGRAM_BOT_TOKEN/TELEGRAM_ALERT_CHAT_ID).",
                notification.id,
            )
            return

        text = (
            f"*{notification.title}*\n{notification.body}"
            if notification.body
            else (notification.title)
        )
        try:
            response = httpx.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                timeout=10,
            )
            response.raise_for_status()
        except httpx.HTTPError:
            logger.exception("Failed to deliver Telegram notification %s.", notification.id)

    def mark_read(self, notification: Notification) -> Notification:
        notification.status = Status.READ
        notification.read_at = timezone.now()
        notification.save(update_fields=["status", "read_at", "updated_at"])
        return notification

    def mark_all_read(self, recipient) -> int:
        """Mark every unread notification for a recipient as read. Returns the
        number updated. Bulk update, so `updated_at` is set explicitly (auto_now
        does not fire on `.update()`)."""
        now = timezone.now()
        return Notification.objects.filter(recipient=recipient, status=Status.UNREAD).update(
            status=Status.READ, read_at=now, updated_at=now
        )

    def mark_archived(self, notification: Notification) -> Notification:
        notification.status = Status.ARCHIVED
        notification.save(update_fields=["status", "updated_at"])
        return notification
