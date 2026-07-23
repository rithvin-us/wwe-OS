# WWE OS — Complete ChatGPT Knowledge Base & Project Blueprint

> **Document Purpose:** Upload file for ChatGPT / Custom GPT Knowledge Base.  
> **Repository:** `rithvin-us/wwe-OS`  
> **Last Updated:** July 2026  
> **Architecture:** Single-Operator Enterprise Business Operations Platform (Monorepo)  

---

## 1. Executive Summary & Vision

**WWE OS** is an Enterprise Business Operations Platform designed for single-operator business workflows (service providers, contractors, equipment suppliers, operations managers). It provides a unified command center, replacing fragmented tools with a single cohesive interface.

### Core Philosophy & UI Laws
- **Single-Operator Efficiency:** Workflows are streamlined for speed. Complex multi-step approvals, low-stock reorder friction, and multi-user delegation overhead are stripped away in favor of direct execution.
- **Unified Interface:** One sidebar, one header, one color palette, one search palette (`Cmd/Ctrl+K`), single-login authentication.
- **Design System:** Built on Tailwind CSS v4, Radix UI primitives, Lucide icons (`@bop/icons`), and OKLCH color tokens (`packages/design-system/src/tokens.css`). Typography features Space Grotesk (headings), Inter (body), and JetBrains Mono (labels/code).

---

## 2. Technical Stack & Infrastructure

| Layer | Technology | Key Details |
| :--- | :--- | :--- |
| **Frontend App** | Next.js 16 (App Router, Turbopack) | React 19, TypeScript 5, Tailwind CSS v4 |
| **Backend Kernel** | Django 5.x REST Framework (DRF) | Python 3.12, Gunicorn WSGI, runs in `bop-backend` container |
| **Database** | PostgreSQL 16 | Container: `bop-postgres` (Port 5432) |
| **Cache & Queue** | Redis 7 | Container: `bop-redis` (Port 6379) |
| **Local SMTP Sink** | Mailpit | Container: `bop-mailpit` (UI Port 8025, SMTP 1025) |
| **Telegram Ingestion** | Python 3.12 service | Container: `bop-telegram-bot`, uses `python-telegram-bot` & Gemini Vision OCR |
| **Storage Layer** | Local Filesystem Abstraction | `platform/storage` service |
| **Monorepo Tooling** | `pnpm` 9 Workspaces | Package management & workspace orchestration |

---

## 3. Core Business Modules & Functional Specifications

### A. Assets & Delivery Challan (DC) Engine (`/assets`)
- **Purpose:** Tracks physical equipment and generates tamper-proof Delivery Challans (DC) for dispatch/site deliveries.
- **Word Template Rendering:** Uses `docxtemplater` / Python docx rendering engine based on Microsoft Word template files (`modules/assets/backend/templates/dc_template.docx` / `DC 26.docx`).
- **Free-Text Products & Flexible Line Items:** Items do not enforce rigid inventory lookups; operators can type arbitrary item names, descriptions, and quantities.
- **Custom Units of Measure (UOM):** Supports arbitrary units (`2 Kg`, `5 Litre`, `1 Lot`, `10 Nos`, `3 Mtr`, `12 Pcs`, etc.).
- **Deliver To Address:** Free-text delivery address field for flexible site recipient details.
- **Verification Hash:** Generates a SHA-256 tamper-proof verification hash stored in `DeliveryChallan.verification_hash` and printed on generated PDFs.
- **DC Deletion & Download:** RESTful support for deleting DCs (`DELETE /api/v1/assets/dcs/{id}/`) and downloading generated PDFs via authenticated Next.js proxy route (`/api/assets/dcs/{id}/download/`).
- **DC Analytics Header:** Component `DCAnalytics` displays total DC counts, Returnable vs. Non-Returnable ratios, monthly generation volume, and visual metrics bars.

### B. Purchases & Telegram Ingestion (`/purchase`)
- **Ingestion Channel:** Telegram Bot (`bop-telegram-bot`) receives receipt photos/documents directly from operator mobile phones.
- **AI OCR Processing:** Uses Gemini / OpenAI Vision models to extract vendor name, total amount, date, line items, and invoice numbers.
- **Service Integration:** Posts structured receipt data directly to `PLATFORM_API_URL` (`http://backend:8000`) authenticated via shared service tokens (`PLATFORM_SERVICE_TOKEN`).
- **Purchase Review UI:** Next.js web application displays incoming bills for manual review, edit, approval, or rejection.

### C. Inventory Management (`/inventory`)
- **Stock Tracking:** Track warehouse items, stock receipts, and stock issues.
- **Single-Operator Optimization:** Low-stock reorder thresholds and low-stock alerts have been deliberately removed (`reorder_level` column dropped) to keep management lightweight.

### D. Document Management System — DMS (`/dms`)
- **File Repository:** Upload, view, categorize, tag, and AI-summarize company documents.
- **Simplified Workflow:** Multi-stage draft/approval/review states have been eliminated. Document statuses are streamlined to `ACTIVE` and `ARCHIVED`.

### E. System Maintenance (`/maintenance`)
- System diagnostics, container health monitoring (`/healthz`), tenant configuration, and AI token/usage monitoring.

---

## 4. Master Repository File Map

```
wwe-OS/
├── apps/
│   └── web/                                 # Platform Next.js Frontend Shell
│       ├── src/
│       │   ├── app/
│       │   │   └── (platform)/
│       │   │       ├── assets/              # Assets & Delivery Challan Pages & Components
│       │   │       │   ├── page.tsx         # Main Assets & DC Table Page
│       │   │       │   ├── dc-analytics.tsx # DC Metrics Summary Banner
│       │   │       │   ├── dc-table.tsx     # DC Data Table & Actions
│       │   │       │   ├── generate-dc-dialog.tsx # DC Creation Form Modal
│       │   │       │   └── actions.ts       # Server Actions for DC Operations
│       │   │       ├── purchase/            # Purchase Review & Receipts UI
│       │   │       ├── inventory/           # Inventory Tracking UI
│       │   │       ├── dms/                 # Document Management UI
│       │   │       ├── maintenance/         # Health & System Diagnostics UI
│       │   │       └── page.tsx             # Main Executive Dashboard (Command Center)
│       │   ├── components/                  # Platform UI Components
│       │   ├── config/                      # Platform Configurations
│       │   │   ├── company.ts               # Global Company Branding Settings
│       │   │   ├── modules.ts               # Registry of Apps & Services
│       │   │   ├── navigation.ts            # Sidebar Navigation Items
│       │   │   └── dashboard.ts             # Executive Dashboard Data Contracts
│       │   └── proxy.ts                     # Auth & Route Proxy Helpers
├── modules/                                 # Business Modules (Domain Logic)
│   ├── assets/
│   │   └── backend/
│   │       ├── api/dc_views.py              # DRF API ViewSets for DCs
│   │       ├── models/dc.py                 # Django DeliveryChallan Models
│   │       ├── serializers/dc.py            # DRF Serializers for DCs
│   │       ├── services/dc.py               # Core DC & PDF Generation Service
│   │       └── templates/                   # Word (.docx) Templates for DCs
│   ├── purchase/                            # Purchase Backend Module & Tests
│   ├── inventory/                           # Inventory Backend Module
│   └── dms/                                 # Document Management Backend Module
├── platform/                                # Django Platform Kernel
│   ├── auth/                                # JWT Authentication & User Management
│   ├── storage/                             # Abstract Storage Interface
│   └── tenancy/                             # Multi-Tenancy Middleware & Base Models
├── services/
│   └── telegram-bot/                        # Telegram Ingestion Service
│       └── main.py                          # Telegram Bot Listener & OCR Ingestion
├── docker-compose.yml                       # Dev Container Orchestration
├── CLAUDE.md                                # Local Development Guidelines
├── GPT_PROJECT_CONTEXT.md                   # Concise GPT Context Document
└── GPT_KNOWLEDGE_BASE.md                    # Detailed Master Knowledge Base (This File)
```

---

## 5. Developer & Operational Commands Cheat Sheet

### Monorepo & Web Application
```bash
# Install dependencies
pnpm install

# Start web frontend dev server (port 3000)
pnpm --filter web dev

# Production build check (TypeScript & lint verification)
pnpm --filter web build
```

### Docker Infrastructure Commands
```bash
# Start all local development containers
docker compose up -d

# Restart Backend Django Service (MANDATORY after Python edits)
docker restart bop-backend

# Restart Telegram Bot Service
docker restart bop-telegram-bot

# Run Django Migrations inside container
docker exec bop-backend python /app/manage.py makemigrations
docker exec bop-backend python /app/manage.py migrate

# Inspect Backend Logs
docker logs -f bop-backend

# Inspect Telegram Bot Logs
docker logs -f bop-telegram-bot
```

---

## 6. Crucial Gotchas, Anti-Patterns & Coding Guidelines

### 1. Gunicorn Container Hot-Reloading
- **Gotcha:** Modifying `.py` backend code inside mounted volumes does **NOT** trigger automatic live reloads inside the running `bop-backend` container.
- **Rule:** ALWAYS execute `docker restart bop-backend` after editing Django models, serializers, views, or services.

### 2. DRF ViewSet Multi-Tenancy & Queryset Scoping
- **Gotcha:** `get_queryset()` in DRF ViewSets must handle superusers or users without explicit `tenant_id` bound (`user.tenant_id is None`).
- **Rule:** Return `.all()` rather than `.none()` when `user.tenant_id is None` or `user.is_superuser` to avoid unexpected 404 errors during retrieval or deletion.

### 3. Next.js Server Actions Error Handling
- **Rule:** Next.js Server Actions in `actions.ts` must return standardized plain response objects:
  ```typescript
  type ActionResponse<T = any> = {
    success: boolean;
    error?: string;
    data?: T;
  };
  ```
  This prevents Next.js from masking server side exceptions as generic "An error occurred" strings.

### 4. Platform Architectural Isolation
- **Rule 1:** All business logic belongs strictly inside `modules/`. `platform/` provides cross-cutting capabilities (auth, tenancy, storage) but never domain-specific rules.
- **Rule 2:** Business modules must never import directly from each other. Cross-module communications pass through platform contracts or domain events.

---

## 7. Sample API Contracts

### Delivery Challan API Summary
- `GET /api/v1/assets/dcs/` — List all Delivery Challans
- `POST /api/v1/assets/dcs/` — Create new Delivery Challan
- `GET /api/v1/assets/dcs/{id}/` — Retrieve single Delivery Challan details
- `DELETE /api/v1/assets/dcs/{id}/` — Delete Delivery Challan record & PDF
- `GET /api/v1/assets/dcs/{id}/download/` — Download generated PDF

---

## 8. Summary for Custom GPT Instructions / Prompting

When acting as an AI assistant for the **WWE OS** project:
1. Always reference the monorepo path structure (`apps/web`, `modules/`, `platform/`, `services/`).
2. Always keep single-operator UX in mind — avoid recommending bloated approval steps or heavy multi-tier permission workflows unless explicitly requested.
3. Keep code snippets modern: Next.js 16 App Router syntax, Tailwind v4, React 19, TypeScript strict mode, Django 5 DRF viewsets with tenant check handling.
4. When writing code modifications for backend Python files, remind the operator to run `docker restart bop-backend`.
