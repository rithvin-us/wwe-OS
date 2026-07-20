# Product Direction — Single-Operator Company

Confirmed 2026-07-20. This is the operating shape WWE OS is built for **now**.
It changes emphasis and roadmap, not the kernel — the Stage 1 foundation already
supports it.

## Operating model

One person runs everything — **HR, IT, and Accounts are the same person**. The
product is a single cockpit for that operator: fast to move through, automation
first, minimal manual work. Everything that can run itself, should.

## Confirmed decisions

| Area         | Decision                                                                           | What it means                                                                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in      | **Both**: Google Workspace SSO **and** email + password                            | One-tap "Sign in with Google" using company mail IDs, with email+password as a fallback. (Backend auth was designed to accept SSO without redesign.)                                                                                |
| Access model | **Single-user; role/permission + multi-company plumbing kept dormant and hidden**  | The operator is auto-assigned the "Owner" role and sees everything — no access gates. Users/Roles/Permissions/Audit screens are removed from the menu; the backend stays in place, ready to re-enable when a second person joins.   |
| Mobile       | **Separate native app** (App Store + Play Store)                                   | A true native app, mobile-first, reusing the same design system and API. Built for all the computations still to come.                                                                                                              |
| HR           | **Already deployed separately — integrate, do not rebuild** (confirmed 2026-07-20) | An HR Automation app already exists and runs in production outside this repo. WWE OS does not build HR from scratch; `modules/hr` stays an empty shell until integration is scheduled. See `docs/specs/hr-integration-strategy.md`. |

## What changed already (web)

- Sidebar reduced to **Dashboard · Apps · Services · Settings**. Users, Roles,
  Permissions and Audit are hidden (`apps/web/src/config/navigation.ts` — the
  entries are commented, one line to restore).
- No functionality removed from the backend; RBAC/tenancy simply sit unused.

## Design principles for a single operator

- **Task cockpit, not department silos.** The dashboard leads with one "needs
  your attention today" surface — approvals, alerts, and to-dos gathered from
  every area — plus quick actions. One person shouldn't hunt across menus.
- **Automation first.** Every module ships its self-service and automatic paths
  before its manual admin screens. The operator manages exceptions, not routine.
- **Mobile-first for everything new.** Design each feature for the phone first;
  the operator runs the company from their pocket.
- **One identity, everywhere.** Same account on web and mobile; sign in once.

## Stage 2 build order (superseded 2026-07-20 — see note)

> **Note:** this list assumed WWE OS would build HR itself. That assumption was
> wrong — HR already exists and runs in production separately; see the row
> above and `docs/specs/hr-integration-strategy.md`. The real, in-progress
> Stage 2 work turned out to be **Purchase bill ingestion via Telegram OCR**
> (the operator was already building this by hand in parallel). Current order:

1. **Purchase ingestion (in progress)** — Telegram → OCR → review queue for
   purchase bills. Backend (`modules/purchase`) and the Telegram channel are
   being built now; see `docs/specs/document-ingestion.md` and
   `docs/specs/purchase.md`.
2. **Sign-in upgrade** — add "Sign in with Google" (and Microsoft if the mail is
   Microsoft 365) alongside email/password. Auto-provision the operator as Owner
   on first sign-in.
3. **Dashboard cockpit** — wire the "needs attention" inbox + quick actions to
   real data (purchases first, then whatever lands next) as it arrives.
4. **HR integration** — connect to the existing, already-deployed HR app per
   the phased plan in `docs/specs/hr-integration-strategy.md`. Not a rebuild.
5. **Native mobile app** — scaffold `apps/mobile` (Expo/React Native), reuse the
   design tokens and the platform API, mobile-first screens.
6. **Remaining apps**, one at a time (Documents, Contracts, …), each automation-
   first, each feeding the dashboard.

Full module-by-module detail, dependency order, and time/risk/cost estimates:
`docs/roadmap/development-roadmap.md`.

## The door left open

Nothing here is one-way. Multi-user access, multiple companies, and per-role
permissions are already built and dormant — the day the company grows, they turn
back on without a rebuild.
