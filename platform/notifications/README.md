# Platform · Notifications

Multi-channel notification dispatch: in-app, email, Telegram, webhooks, push.
Templates, user channel preferences, delivery tracking, digests.

- Owns: channels, templates, preferences, delivery.
- Modules emit notification events; they never talk to a channel directly.
- Delivery is executed by `services/email-service`, `services/telegram-bot`, etc.
