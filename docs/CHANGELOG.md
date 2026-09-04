# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [1.0.0] - 2026-09-04

First production release of **WWE OS** (Water Works Engineering OS) — an
Enterprise Business Operations Platform that runs a whole company's operations
on one shared kernel. Built for a **single operator** (HR + IT + Accounts in
one person): one sign-in, no role gates in the UI, a task cockpit instead of
silos, and automation-first modules. The multi-tenant + RBAC backend ships
dormant, ready for the day a second person joins.

### Platform kernel

- Django 6 + DRF stateless JWT API kernel exposing `/api/v1/`; DRF
  authenticates per request (no server-side sessions).
- **25 capability apps** installed, in load-bearing order so `post_migrate`
  hooks fire correctly: `shared`, `tenancy`, `users`, `auth`, `permissions`,
  `roles`, `audit`, `notifications`, `storage`, `periods`, `identity`,
  `metadata`, `rules`, `auditor`, `ai`, `search`, `reporting`, `tagging`,
  `workflow`, `automation`, `alerts`, `deadlines`, `approvals`, `briefing`,
  `backups`.
- Multi-tenant data scoping and an RBAC permission/role system (Owner role
  granted every registered permission). Dormant in single-operator mode.
- Domain event bus for cross-capability reactions — capabilities and modules
  never import each other directly.
- **AI gateway** (`platform/ai`): a provider-agnostic `AIService` with a model
  routing table over `httpx`. Google Gemini is the default provider. Modules
  never call a provider URL or import an AI SDK — everything goes through the
  gateway.

### Business modules

Business logic lives in `modules/`; each installed module registers its own
permissions and event subscribers through the platform contracts.

- **HR** — migrated in from the retired standalone HR Automation app
  (FastAPI + SQLAlchemy). Employees, attendance, payroll, statutory registers,
  leave, onboarding, expenses, and face check-in. The verified payroll and
  shift engines were copied verbatim and their legacy test suites run against
  them unchanged.
- **Purchases** — Telegram-bot bill ingestion via OCR, with a review queue.
  The reference implementation for module layering, permission registration,
  and event subscription.
- **Invoices / Finance** — in-house invoice generation and sales billing, a
  bill register, lifecycle-guarded deletion of invoices and customers, and
  bulk historical-invoice import via OCR.
- **Documents (DMS)** — outside incoming files, contracts, and email
  attachments.
- **Delivery Challans** — generate and track delivery challans.
- **Contracts** and **Inventory** — backends installed (Inventory kept
  dormant in the UI for now).

### Experience — web app

- Next.js 16 platform shell: **one** sidebar, header, login, notification
  center, and command palette — never restyled per module.
- **Executive Dashboard** as the landing page — a company command center
  answering "how is my company doing today?": business KPIs, pending
  approvals, operational alerts, and financial / people / inventory /
  procurement / contracts summaries, recent activity, AI insights, and quick
  actions. A `live` / `error` / `unwired` KPI contract keeps real fetch
  failures from hiding behind the same blank as "not in use yet". No fake data.
- **Workspace cockpit** (cross-cutting operator surfaces): Focus (briefing),
  Approvals, Deadlines, and Assistant.
- **Business Timeline** — everything that happened across the company in one
  feed.
- **Reports** — ready-made reports on demand or on a schedule, with Excel and
  PDF renderers.
- **Automation** — collects tagged records on a schedule (packages, reports,
  auditor folders).
- Design system (`@bop/ui`, `@bop/icons`, `@bop/charts`, design tokens):
  token-only color/spacing/radius, full dark mode, mobile-first, accessible.
- Sign-in with Google Workspace SSO **and** email + password.

### AI capabilities

- **Rithu AI** — the contextual business co-pilot, surfaced across the shell
  (chat widget, `/assistant`, and assistant settings), answering questions
  about company data. Runs on Gemini through the platform AI gateway.
- **Face-AI** — a FastAPI microservice for biometric attendance check-in
  (ArcFace / MTCNN facial recognition with anti-spoofing / liveness),
  deployment-isolated and integrated over its API.

### Mobile

- Capacitor Android wrapper of the web app, built in CI.
- A separate Expo / React Native native workstream (in progress), reusing the
  design tokens and API.

### Security & CI

- Two-pass secret scanning with gitleaks — pushed commits **and** the full
  working tree — closing the single-commit blind spot.
- Blocking dependency-audit gates: `pnpm audit --audit-level=high` and
  `pip-audit`. Fixable advisories are fixed, not suppressed.
- CodeQL and Codacy static security analysis.
- SSRF and path-injection hardening across file/URL handling.
- CI gates that must pass before merge: Biome (format + lint), Next.js lint,
  frontend build, `tsc --noEmit`, Vitest, Ruff (check + format), Django
  `manage.py check`, and `pytest`.

### Infrastructure

- Local infrastructure via Docker Compose (PostgreSQL, Redis, Mailpit).
- Deploy targets: Vercel (web), Render (backend and services), and Cloudflare
  Tunnel (AI / Face-AI).
- Monorepo scaffolding: `apps/`, `platform/`, `modules/`, `services/`,
  `packages/`, `database/`, `infrastructure/`, `docs/`; pre-commit hooks
  (Ruff, Biome, gitleaks, hygiene) and pinned Python/Node toolchains.

### Security fixes

- Pinned `browserslist` to `>=4.28.7` to clear two high-severity transitive
  advisories (GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g).
- Bumped `pypdf` to `6.16.1` (security release) in the Telegram bot service.

[Unreleased]: https://github.com/rithvin-us/wwe-OS/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rithvin-us/wwe-OS/releases/tag/v1.0.0
