from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from django.conf import settings
from django.core.mail import EmailMessage, get_connection
from django.utils import timezone
from pywebpush import WebPushException, webpush
from shared.events import Events, publish
from shared.services import BaseService

from notifications.models import Channel, Notification, PushSubscription, Status

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
        webhooks are wired by their service later. Push fans out to every
        subscribed browser regardless of `channel` — it's a delivery
        surface, not something a caller opts a notification into."""
        if notification.channel == Channel.EMAIL and notification.recipient.email:
            self._send_email(notification)
        elif notification.channel == Channel.TELEGRAM:
            self._send_telegram(notification)
        elif notification.channel == Channel.WEBHOOK:
            logger.info(
                "Notification %s queued for %s channel (delivery service pending).",
                notification.id,
                notification.channel,
            )
        self._send_push(notification)

    @staticmethod
    def _tenant_config(tenant) -> dict:
        return getattr(tenant, "config", None) or {}

    def _send_email(self, notification: Notification) -> None:
        """Tenant SMTP config (set via Maintenance > Integrations) takes
        priority over the process-wide EMAIL_HOST_* settings, so an operator
        can turn email on without a redeploy. Best-effort — a delivery
        failure never breaks the caller that created the notification."""
        cfg = self._tenant_config(notification.tenant)
        smtp_host = cfg.get("smtp_host") or ""

        connection = (
            get_connection(
                backend="django.core.mail.backends.smtp.EmailBackend",
                host=smtp_host,
                port=int(cfg.get("smtp_port") or 587),
                username=cfg.get("smtp_user") or "",
                password=cfg.get("smtp_password") or "",
                use_tls=bool(cfg.get("smtp_use_tls", True)),
            )
            if smtp_host
            else None  # falls back to Django's configured EMAIL_BACKEND
        )
        from_email = cfg.get("smtp_from") or settings.DEFAULT_FROM_EMAIL

        try:
            EmailMessage(
                subject=notification.title,
                body=notification.body,
                from_email=from_email,
                to=[notification.recipient.email],
                connection=connection,
            ).send(fail_silently=False)
        except Exception:  # noqa: BLE001 - best-effort delivery, never raise
            logger.exception("Failed to deliver email notification %s.", notification.id)

    def _send_push(self, notification: Notification) -> None:
        """Best-effort browser push to every device the recipient has
        subscribed. A 404/410 response means the browser dropped the
        subscription (uninstalled, permission revoked, storage cleared) —
        clean it up rather than retry it forever."""
        if not settings.VAPID_PRIVATE_KEY:
            return
        subscriptions = PushSubscription.objects.filter(recipient=notification.recipient)
        if not subscriptions.exists():
            return

        payload = json.dumps(
            {
                "title": notification.title,
                "body": notification.body,
                "data": {
                    "category": notification.category,
                    "notification_id": str(notification.id),
                },
            }
        )
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key},
                    },
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIM_EMAIL}"},
                )
            except WebPushException as exc:
                status_code = getattr(exc.response, "status_code", None)
                if status_code in (404, 410):
                    sub.delete()
                else:
                    logger.warning(
                        "Push delivery to subscription %s failed (%s): %s",
                        sub.id,
                        status_code,
                        exc,
                    )

    def _send_telegram(self, notification: Notification) -> None:
        """Tenant config (set via Maintenance > Integrations) takes priority
        over the process-wide TELEGRAM_* settings. Single fixed chat id per
        tenant — the single-operator model has exactly one Telegram
        destination, not a per-recipient mapping."""
        cfg = self._tenant_config(notification.tenant)
        token = cfg.get("telegram_bot_token") or settings.TELEGRAM_BOT_TOKEN
        chat_id = cfg.get("telegram_chat_id") or settings.TELEGRAM_ALERT_CHAT_ID
        if not token or not chat_id:
            logger.info(
                "Notification %s not sent — Telegram isn't configured "
                "(set the bot token and chat id in Maintenance > Integrations).",
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
