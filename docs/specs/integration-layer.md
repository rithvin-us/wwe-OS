# Integration Layer

**Status: partially built.** Telegram (bot + service-token auth) is real.
Email, Google/Microsoft sign-in, and outbound webhooks are not built. This
document is the map of every external integration point and where it stands.

## 1. Functional requirements

| Integration                | Status                                         | Direction                                  |
| -------------------------- | ---------------------------------------------- | ------------------------------------------ |
| Telegram bot               | **Built**                                      | Inbound (documents → platform)             |
| Google Sign-In             | Not built                                      | Inbound (identity)                         |
| Microsoft Sign-In          | Not built                                      | Inbound (identity)                         |
| Email (SMTP send)          | **Built** (transactional: verification, reset) | Outbound                                   |
| Email (inbound processing) | Not built                                      | Inbound (documents/requests → platform)    |
| Webhooks (outbound)        | Not built                                      | Outbound (platform events → third parties) |
| REST API                   | **Built** (`/api/v1/`)                         | Both — the substrate everything above uses |

## 2. Non-functional requirements

- Every inbound integration authenticates via one of exactly two schemes
  (`_shared-conventions.md` § Security) — no integration invents its own
  auth.
- Every outbound integration is retried on transient failure, never silently
  dropped (the Telegram bot's platform-POST retry, built, is the reference
  pattern — see `services/telegram-bot/main.py::_post_to_platform`).

## 3. Database schema

No schema of its own; each integration's data lands in the owning
capability (`auth` for SSO, `notifications` for delivery, the ingesting
module for documents). Webhooks (future) would need
`webhook_subscription` / `webhook_delivery_log` in `platform/notifications`
or a new `platform/webhooks` — not yet designed.

## 4. Entity relationships

```
External system → (auth scheme) → Platform API → owning capability/module
Platform event → (future) webhook dispatcher → subscriber's URL
```

## 5. Folder structure (built + planned)

```
services/telegram-bot/     Built.
services/email-service/    Scaffolded, unimplemented — inbound processing +
                           templated outbound delivery beyond today's direct
                           SMTP calls from platform/auth.
platform/shared/service_auth.py   Built — reused by every future inbound
                                   service integration, not re-implemented.
platform/auth/                    JWT auth built; SSO providers attach here
                                   (see docs/architecture/authentication.md —
                                   designed for this from Stage 1).
```

## 6. Backend architecture

**Google/Microsoft Sign-In**: `PlatformJWTAuthentication` and the user model
were deliberately designed so an OAuth flow issues the platform's own JWT
pair after verifying the provider's token — no redesign needed, an addition:
a new `POST /api/v1/auth/sso/google/` view that verifies the Google ID token
server-side, resolves/creates the `User`, and calls the same
`AuthService.issue_tokens()` the password flow already uses.

**Email inbound**: would follow the exact ingestion pattern already proven
by Telegram — a service (`services/email-service`) that receives mail,
extracts what it can, and POSTs to a module's `.../ingest/` endpoint with
`ServiceTokenAuthentication`, same as the bot.

## 7. Frontend architecture

The login page (`apps/web/src/app/login/`, built) already has the layout
slot for SSO buttons — adding "Sign in with Google" is a UI addition to an
existing page, not a new page.

## 8. API design (planned additions)

```
POST /api/v1/auth/sso/google/     { id_token } -> { access, refresh }
POST /api/v1/auth/sso/microsoft/  { id_token } -> { access, refresh }
POST /api/v1/notifications/webhooks/     (subscription management, future)
```

## 9. Validation rules

SSO: the provider's token signature and audience are verified server-side
before trusting any claim from it — never trust a client-supplied email
without provider verification.

## 10. Business logic

First SSO sign-in for an email that doesn't yet have an account: in
single-operator mode, auto-provision it (this is the "tenant/company
bootstrap" gap flagged in `docs/roadmap/development-roadmap.md` — SSO
sign-in is the natural moment to solve it, not a separate flow).

## 11. Background jobs

Webhook delivery (future) should be queued and retried with backoff, not
sent synchronously from the event that triggered it.

## 12. Event flow

Outbound webhooks (future) would subscribe to the same `shared.events` bus
every other capability already uses — a webhook dispatcher is just another
subscriber, publishing to an HTTP endpoint instead of writing an audit row.

## 13. Queue design

Shares the queue infrastructure noted in `docs/specs/reports.md` § 13 once
webhook delivery or inbound email processing needs it.

## 14–17. Error handling, security, testing, deployment

Follow `_shared-conventions.md`. Built and tested today: service-token
rejection paths (`modules/purchase/backend/tests/test_ingest.py`), which are
the reference test shape for every future inbound integration.

## 18. Mobile integration

SSO on mobile uses the platform's native SDKs (Google/Microsoft each provide
one) but resolves to the same backend endpoints as web — one identity
system, two client implementations of the same OAuth handshake.

## 19. Dashboard integration

N/A directly — integrations feed data into modules, which feed the
dashboard, per each module's own spec.

## 20. Future scalability

A generic "inbound service" contract (auth scheme + retry pattern + ingest
target) is implicit in Telegram's implementation today; formalizing it (a
small shared library/base class in `platform/shared`) is worth doing once
email-service is built and the pattern is proven twice, not before.
