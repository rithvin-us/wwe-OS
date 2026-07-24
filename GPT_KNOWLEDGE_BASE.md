# WWE OS — Master Knowledge Base & ChatGPT Context Blueprint

> **Document Purpose:** Single-file copy-pasteable knowledge base for ChatGPT, Custom GPTs, and AI Coding Assistants.  
> **Repository:** `rithvin-us/wwe-OS`  
> **Last Updated:** July 2026  
> **Architecture:** Single-Operator Enterprise Business Operations Platform (Monorepo)

---

## 1. Executive Summary & Platform Philosophy

**WWE OS** is an Enterprise Business Operations Platform designed specifically for single-operator business workflows (service providers, contractors, equipment suppliers, operations managers). It unifies core business operations into a single cohesive interface, replacing fragmented tools.

### Core UI Laws & Philosophy

- **Single-Operator Efficiency:** Workflows are optimized for direct execution. Multi-stage approval chains, low-stock reorder friction, and multi-tier delegation overhead are eliminated.
- **Unified Interface ("One Chrome"):** Single sidebar, sticky header (`56px`), OKLCH color palette, search palette (`Cmd/Ctrl+K`), and single HTTP-only cookie login session.
- **Design System:** Built on Tailwind CSS v4, Radix UI primitives, Lucide icons (`@bop/icons`), and OKLCH color tokens (`packages/design-system/src/tokens.css`).
- **Typography:** Space Grotesk (headings), Inter (body), JetBrains Mono (labels/code).

---

## 2. Technology Stack & Infrastructure

| Layer                  | Technology                           | Key Details                                                                    |
| :--------------------- | :----------------------------------- | :----------------------------------------------------------------------------- |
| **Frontend Shell**     | Next.js 16 (App Router, Turbopack)   | React 19, TypeScript 5, Tailwind CSS v4                                        |
| **Backend Kernel**     | Django 5.x REST Framework (DRF)      | Python 3.12, Gunicorn WSGI, container `bop-backend` (Port 8000)                |
| **Database**           | PostgreSQL 16                        | Container `bop-postgres` (Port 5432)                                           |
| **Cache & Queue**      | Redis 7                              | Container `bop-redis` (Port 6379)                                              |
| **Local SMTP Sink**    | Mailpit                              | Container `bop-mailpit` (UI Port 8025, SMTP 1025)                              |
| **Telegram Ingestion** | Python 3.12 Bot                      | Container `bop-telegram-bot`, `python-telegram-bot` & Gemini/OpenAI Vision OCR |
| **Storage Layer**      | Local Filesystem Storage Abstraction | `platform/storage` service                                                     |
| **Monorepo Manager**   | `pnpm` 9 Workspaces                  | Package management & workspace orchestration                                   |

---

## 3. Architecture & Security Model

### Monorepo Architectural Isolation

1. **Module Isolation:** All business logic belongs strictly inside `modules/`. `platform/` provides cross-cutting capabilities (auth, tenancy, storage, AI) without domain rules.
2. **No Direct Module Imports:** Modules must never import directly from each other. Cross-module communication passes through platform contracts or domain events.
3. **Multi-Tenancy Scoping:** All tenant database models inherit `TenantOwnedModel`.

### Authentication & Token Security

- **HTTP-Only Cookies:** Browser JS never accesses raw JWT tokens. Next.js auth proxy (`/api/auth/login/route.ts`) calls Django `/api/v1/auth/login/` and sets `access_token` (15 min) & `refresh_token` (7 or 30 days) as `httpOnly` cookies.
- **Server API Wrapper:** Next.js Server Components and Server Actions fetch Django API endpoints using `djangoFetch<T>()` / `djangoFetchPage<T>()` from `src/lib/api/server.ts`, which automatically attaches `Authorization: Bearer <access_token>`.
- **Response Envelope:** Django API wraps all payloads via `ApiEnvelope<T>` (`{ success: true, data: T, meta?: ... }` or `{ success: false, error: { code, message, details } }`).
- **Server Actions:** Next.js Server Actions return standard response objects `{ success: boolean, error?: string, data?: T }` to prevent Next.js from masking server exceptions.

---

## 4. Core Business Modules & Functional Specifications

### A. Assets & Delivery Challan (DC) Engine (`/assets`)

- **Purpose:** Tracks physical equipment and generates tamper-proof Delivery Challans (DC) for dispatch/site deliveries.
- **Word Template Rendering:** Renders dynamic Word `.docx` templates (`modules/assets/backend/templates/dc_template.docx` / `DC 26.docx`) into client-ready PDFs.
- **Free-Text Line Items:** Operators can type arbitrary product names, descriptions, and quantities without rigid inventory lookups.
- **Custom Units of Measure (UOM):** Accepts arbitrary units (`2 Kg`, `5 Litre`, `1 Lot`, `10 Nos`, `3 Mtr`, `12 Pcs`).
- **Deliver To Address:** Free-text delivery address field.
- **Verification Hash:** Generates SHA-256 tamper-proof hash stored in `DeliveryChallan.verification_hash` and rendered on PDFs.
- **Deletion & Download:** REST APIs for deletion (`DELETE /api/v1/assets/dcs/{id}/`) and PDF download (`/api/assets/dcs/{id}/download/`).
- **Analytics Banner:** `DCAnalytics` header displays total DC count, Returnable vs. Non-Returnable metrics, monthly output, and visual ratio bar.

### B. Purchases & Telegram Receipt Ingestion (`/purchase`)

- **Ingestion Channel:** Telegram Bot (`bop-telegram-bot`) listens for receipt images/documents sent via mobile.
- **AI OCR Processing:** Extracts vendor, date, line items, tax, and total amount via Gemini / OpenAI Vision models.
- **Backend API Sync:** Posts structured receipt data directly to `PLATFORM_API_URL` (`http://backend:8000`) using shared service token `PLATFORM_SERVICE_TOKEN`.
- **Payment Lifecycle Endpoints:** REST API supports full payment transitions including `POST /api/v1/purchase/bills/{id}/mark-paid/` and `POST /api/v1/purchase/bills/{id}/unmark-paid/`.
- **Purchase Review UI & Safety Controls:** Next.js application displays incoming bills with mandatory confirmation modals before Mark Paid, Unmark Paid, Deactivate Vendor, or Delete operations.
- **Standardized UI Vocabulary & Design Tokens:** Extracted monetary/date formatters (`format.ts`), reusable `DeleteBillWarning` component, and `SectionCard`-based AI Insights cards adhering to design tokens.

### C. Inventory Management (`/inventory`)

- Stock tracking, receipts, and issues. Low-stock alerts and reorder level thresholds removed for single-operator speed.

### D. Document Management System — DMS (`/dms`)

- Upload, store, categorize (`CONTRACT`, `INVOICE`, `COMPLIANCE`, `TECHNICAL`, etc.), and AI-summarize company documents (`src/lib/dms.ts`). Document statuses simplified to `ACTIVE` and `ARCHIVED`.

### E. System Maintenance (`/maintenance`)

- System diagnostics, health checks (`/healthz`), tenant settings, and AI token usage monitoring.

### F. Platform Reliability & Error Resilience (`(platform)`)

- **Error Boundaries:** Platform-wide `apps/web/src/app/(platform)/error.tsx` catches client and server rendering exceptions, presenting an `EmptyState` fallback with recovery actions while leaving header/sidebar active.
- **Dashboard Relative Freshness:** Dashboard greeting tracks data resolution (`dataAsOf`) and renders a live relative time indicator ("Updated Xm ago") with smooth crossfade transitions.

---

## 5. Master Repository File Map

```
wwe-OS/
├── .github/
│   └── workflows/
│       └── ci.yml                           # GitHub Actions CI (lint, pytest, build)
├── apps/
│   └── web/                                 # Platform Next.js Frontend Shell
│       ├── src/
│       │   ├── app/
│       │   │   ├── (platform)/
│       │   │   │   ├── assets/              # Assets & Delivery Challan Pages
│       │   │   │   │   ├── page.tsx         # Main DC Table Page
│       │   │   │   │   ├── dc-analytics.tsx # DC Metrics Banner
│       │   │   │   │   ├── dc-table.tsx     # DC Data Table & Actions
│       │   │   │   │   ├── generate-dc-dialog.tsx # DC Form Modal
│       │   │   │   │   └── actions.ts       # DC Server Actions
│       │   │   │   ├── purchase/            # Purchase Review UI & Vendor Management
│       │   │   │   │   ├── bill-details-dialog.tsx # Bill Detail Dialog
│       │   │   │   │   ├── bills-table.tsx  # Bills Table & Actions
│       │   │   │   │   ├── delete-bill-warning.tsx # Delete Confirmation Modal
│       │   │   │   │   ├── format.ts        # Money/Date Formatters (formatINR, etc.)
│       │   │   │   │   └── vendors-panel.tsx# Vendor Management Panel
│       │   │   │   ├── inventory/           # Inventory Tracking UI
│       │   │   │   ├── dms/                 # Document Management UI
│       │   │   │   ├── maintenance/         # System Health UI
│       │   │   │   ├── error.tsx            # Platform-wide Error Boundary Fallback
│       │   │   │   └── page.tsx             # Main Command Center Dashboard
│       │   │   └── api/
│       │   │       └── auth/                # Auth Proxy Routes (login/logout/me)
│       │   ├── components/                  # Shared Shell Components & Dashboard Greeting
│       │   ├── config/                      # Platform Configs (company, modules, nav, dashboard)
│       │   └── lib/
│       │       ├── api/                     # Server fetch wrapper (`server.ts`, `envelope.ts`)
│       │       └── dms.ts                   # DMS Client/Server Helpers
```

├── modules/ # Business Modules (Domain Logic)
│ ├── assets/
│ │ └── backend/
│ │ ├── api/dc_views.py # DRF API ViewSets for DCs
│ │ ├── models/dc.py # Django DeliveryChallan Models
│ │ ├── serializers/dc.py # DRF Serializers for DCs
│ │ ├── services/dc.py # DC & PDF Generation Service
│ │ └── templates/ # Word (.docx) Templates for DCs
│ ├── purchase/ # Purchase Backend Module
│ ├── inventory/ # Inventory Backend Module
│ └── dms/ # Document Management Backend Module
├── platform/ # Django Platform Kernel
│ ├── auth/ # JWT Auth & User Management
│ ├── storage/ # Abstract Storage Interface
│ └── tenancy/ # Multi-Tenancy Middleware & Base Models
├── packages/ # Shared Monorepo UI Packages
│ ├── design-system/ # CSS Tokens (`tokens.css`)
│ ├── ui/ # Component Library
│ └── icons/ # Lucide Icons Gate
├── services/
│ └── telegram-bot/ # Telegram Bot Ingestion Service
│ └── main.py # Telegram Listener & OCR Ingestion
├── docker-compose.yml # Dev Container Orchestration
├── CLAUDE.md # Development Rules & Instructions
├── GPT_PROJECT_CONTEXT.md # Quick Context Summary
└── GPT_KNOWLEDGE_BASE.md # Master Copy-Pasteable Knowledge Base

````

---

## 6. Developer & Operational Commands Cheat Sheet

### Web Frontend & Monorepo

```bash
# Install dependencies
pnpm install

# Run web app dev server (http://localhost:3000)
pnpm --filter web dev

# Production build check (TypeScript & lint verification)
pnpm --filter web build
````

### Docker Infrastructure & Django Backend

```bash
# Start all local development containers
docker compose up -d

# Restart Django Backend (MANDATORY after Python edits)
docker restart bop-backend

# Restart Telegram Bot Service
docker restart bop-telegram-bot

# Run Django Migrations inside container
docker exec bop-backend python /app/manage.py makemigrations
docker exec bop-backend python /app/manage.py migrate

# View Container Logs
docker logs -f bop-backend
docker logs -f bop-telegram-bot
```

---

## 7. Crucial Gotchas, Anti-Patterns & Coding Guidelines

### 1. Gunicorn Container Hot-Reloading

- **Gotcha:** Editing `.py` Python code on host disk volumes does **NOT** auto-reload inside running `bop-backend` container.
- **Rule:** ALWAYS execute `docker restart bop-backend` after editing Django models, serializers, views, or services.

### 2. DRF ViewSet Multi-Tenancy Queryset Scoping

- **Gotcha:** `get_queryset()` in DRF ViewSets must account for superusers or users without explicit `tenant_id` bound (`user.tenant_id is None`). Returning `.none()` causes DRF to raise `404 Not Found` during retrieval or deletion.
- **Rule:** Check `if user.is_superuser or user.tenant_id is None:` and return `.all()`.

### 3. Server Actions Error Handling

- **Rule:** Wrap server action API calls in try/catch and return plain serializable objects:
  ```typescript
  type ActionResponse<T = any> = {
    success: boolean;
    error?: string;
    data?: T;
  };
  ```

### 4. Telegram Bot ISP Connection Resets

- **Gotcha:** ISP firewalls in certain regions block direct TCP port 443 connections to `api.telegram.org`.
- **Solution:** Switch to VPN or configure proxy settings in `docker-compose.yml`.

---

## 8. Summary for Custom GPT Instructions / Prompting

When acting as an AI coding assistant for **WWE OS**:

1. Follow monorepo path structure (`apps/web`, `modules/`, `platform/`, `services/`, `packages/`).
2. Keep single-operator UX top of mind — avoid multi-tier permissions or complex approval steps.
3. Use modern web standards: Next.js 16 App Router, Tailwind CSS v4, React 19, TypeScript strict, Django 5 DRF viewsets with tenant checks.
4. Always remind the operator to run `docker restart bop-backend` after generating or updating backend Python code.
