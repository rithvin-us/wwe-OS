# Module Intelligence · Notifications

Route `/notifications` · Domain: Platform capability · Status: **Built (v1) — 2026-07-21**

## 1. Business purpose

Route every platform event to the right person and surface it in one place.

## Built (v1) — shipped surface

Notifications is a **platform capability** (`platform/notifications`), not a
business module — and there is exactly **one** notification center, per the
design bible. v1 wires the real data end to end:

- **Backend** (already existed; extended this session): per-recipient list,
  `unread-count`, `read`, `archive`, and a new **`read-all`** bulk action.
  Every module publishes into it via `NotificationService` — workflow
  approvals, document/contract outcomes, contract-renewal reminders, low-stock
  alerts, and asset disposals all land here.
- **The one bell** (`components/notification-center.tsx`): now live — an unread
  badge, the recent list, click-to-open (routed from the publishing module's
  category + ids), mark-one/mark-all read, and a "View all" link. No app ships
  its own bell.
- **`/notifications` page**: the fuller view of the _same_ center — full
  history with All/Unread/Read/Archived filters, per-item read/archive, and
  mark-all-read. Reached from the bell; not a second surface.
- **BFF**: the client bell reads through `/api/notifications*` route handlers
  (the token stays in the httpOnly cookie); the page uses server components +
  server actions.

**Not in v1** (roadmap below): per-user channel preferences and quiet hours,
email/Telegram delivery of in-app notifications (channels are declared;
delivery services land later), digests, and delivery-status tracking.

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
