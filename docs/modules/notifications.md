# Module Intelligence · Notifications

Route `/notifications` · Domain: Insight & decisions · Status: In development (platform capability with a center UI)

## 1. Business purpose

Route every platform event to the right person on the right channel — in-app, email, Telegram — with user preferences, digests, and delivery tracking.

## 2. Problems it solves

- Modules notifying inconsistently or not at all
- Users flooded on one channel, missing another entirely
- No record of what was sent to whom
- Preference handling reimplemented per feature

## 3. Primary users

All staff (recipients, preferences), module developers (emit events), admins (routing policy).

## 4. Future integrations

Email service, Telegram bot, web push; every business module as an event source; Approvals and Workflow as the heaviest emitters.

## 5. Database entities

`notification_event`, `notification`, `channel_delivery`, `user_preference`, `digest_schedule`, `notification_template_link`.

## 6. APIs

- `POST /api/notifications/emit` (module-internal)
- `GET /api/notifications/inbox` · `POST /api/notifications/{id}/read`
- `GET/PUT /api/notifications/preferences`

## 7. Dashboard widgets

Unread by category · Delivery by channel (24h) · Digest schedules · Failed deliveries.

## 8. KPIs

Delivery success per channel · Read rate · Preference adoption · Duplicate-notification rate (should be zero).

## 9. Permissions

`notifications.read.self`, `notifications.preferences.self`, `notifications.policy.manage`, `notifications.admin`.

## 10. Navigation structure

Inbox · Preferences · Routing policy (admin) · Delivery log (admin).

## 11. Relationships with other modules

The platform's one notification pipeline (`platform/notifications`); the header bell and this center are its only UI; Email and Telegram services are its delivery arms; modules emit events and never touch channels.

## 12. AI opportunities

Priority scoring (interrupt now vs digest) · Personal notification summaries · Adaptive channel choice from user behavior.
