# Module Intelligence · Email Automation

Route `/email` · Domain: Automation · Status: Planned

## 1. Business purpose

Deliver every platform notification by mail from templates, and turn inbound mail into structured platform events — one email brain instead of per-module SMTP code.

## 2. Problems it solves

- Modules each wiring their own SMTP and templates
- Inconsistent branding and tone in outbound mail
- Inbound requests (invoices, applications) manually forwarded
- No delivery tracking or bounce handling

## 3. Primary users

Platform admins (templates, domains), modules (senders via API), staff (recipients).

## 4. Future integrations

`services/email-service` (delivery), Notifications (channel), Reports (distribution), OCR (attachment processing), Workflow (mail-triggered processes).

## 5. Database entities

`email_template`, `outbound_message`, `delivery_event`, `inbound_message`, `inbound_rule`, `sender_identity`, `suppression_entry`.

## 6. APIs

- `POST /api/email/send` (template + data, module-invoked)
- `GET /api/email/messages/{id}` · `GET/POST /api/email/templates`
- `GET/POST /api/email/inbound-rules`

## 7. Dashboard widgets

Delivery rate (24h) · Bounces and complaints · Queue depth · Inbound messages routed today.

## 8. KPIs

Delivery success rate · Bounce rate · Template coverage (notifications with a template) · Inbound auto-routing rate.

## 9. Permissions

`email.send` (module service accounts), `email.template.manage`, `email.inbound.configure`, `email.logs.read`, `email.admin`.

## 10. Navigation structure

Overview · Outbound log · Templates · Inbound rules · Identities.

## 11. Relationships with other modules

The delivery arm of platform Notifications; Reports ship through it; OCR consumes inbound attachments; runs as the independent `services/email-service`.

## 12. AI opportunities

Inbound intent classification and routing · Reply drafting for common requests · Template copy suggestions in the platform's voice.
