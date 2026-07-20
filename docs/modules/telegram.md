# Module Intelligence · Telegram Automation

Route `/telegram` · Domain: Automation · Status: Planned

## 1. Business purpose

Bring approvals, alerts, and quick commands to the messenger the team already uses — instant notification and action without opening the web app.

## 2. Problems it solves

- Urgent approvals wait until someone opens a laptop
- Visitors/incidents need instant host alerts
- Field staff have phones, not workstations
- Notification mail ignored; chat read in seconds

## 3. Primary users

Approvers (act from chat), field staff (commands), reception/security (alerts), admins (bot configuration).

## 4. Future integrations

`services/telegram-bot` (runtime), Notifications (channel), Approvals (inline actions), Visitors (host pings), AI Assistant (chat surface), HR (leave requests by command).

## 5. Database entities

`telegram_link` (user ↔ chat, verified), `bot_command`, `interaction_log`, `subscription_preference`, `broadcast`.

## 6. APIs

- `POST /api/telegram/link/start` · `POST /api/telegram/link/verify`
- `POST /api/telegram/notify` (platform-internal channel API)
- `GET /api/telegram/commands` · `GET/POST /api/telegram/broadcasts`

## 7. Dashboard widgets

Linked accounts · Messages delivered (24h) · Inline actions taken · Command usage.

## 8. KPIs

Link adoption rate · Delivery latency · Action-from-chat rate · Unlink/opt-out rate.

## 9. Permissions

Actions in chat carry the linked user's platform permissions — the bot never grants more than the web app would. Module-level: `telegram.link.self`, `telegram.broadcast`, `telegram.admin`.

## 10. Navigation structure

Overview · Linked accounts · Commands · Broadcasts.

## 11. Relationships with other modules

A delivery and action channel for Notifications and Approvals; identity always resolves to a platform user via verified linking; runs as the independent `services/telegram-bot`.

## 12. AI opportunities

Natural-language commands ("book leave Thu–Fri") mapped to module actions · AI Assistant conversations directly in Telegram · Smart notification batching per user.
