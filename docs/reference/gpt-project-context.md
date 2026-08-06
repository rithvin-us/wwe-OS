# WWE OS — Comprehensive Project Context for GPT / AI Assistants

> **Last Updated:** July 24, 2026  
> **Repository:** `rithvin-us/wwe-OS`  
> **Architecture:** Single-operator Enterprise Business Operations Platform (Monorepo)  
> **Detailed Knowledge Base:** See [gpt-knowledge-base.md](gpt-knowledge-base.md) for full system specifications.

---

## 1. Project Overview & Architecture

WWE OS is a single-operator business operations platform tailored for service providers, suppliers, and contractor operations.

- **Frontend:** Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, Radix UI, Lucide Icons (`@bop/icons`).
- **Backend Kernel:** Django 5.x REST Framework (DRF), Python 3.12, Gunicorn. Container: `bop-backend` (Port 8000).
- **Database:** PostgreSQL 16 (`bop-postgres`), Redis 7 (`bop-redis`), Mailpit (`bop-mailpit`).
- **Object Storage:** Local filesystem storage abstraction (`platform/storage`).
- **Telegram Bot Service:** Python 3.12 bot (`bop-telegram-bot`) using `python-telegram-bot` and OpenAI/Gemini vision for receipt OCR.

---

## 2. Key Modules & Functional Features

### A. Assets & Delivery Challans (`/assets`)

- **Delivery Challan (DC) Generation:** Generates dynamic PDFs from a Microsoft Word template (`modules/assets/backend/templates/dc_template.docx` / `DC 26.docx`).
- **Free-Text Products & Units:** Free-text product input; supports custom measurement units (e.g., `2 Kg`, `5 Litre`, `1 Lot`, `10 Nos`, `3 Mtr`, `12 Pcs`).
- **Custom Deliver To Address:** Free-text delivery address field.
- **Tamper-Proof Verification Hash:** Generates a SHA-256 hash (`verification_hash`) for every PDF document and stores it on the `DeliveryChallan` model.
- **Deletion & Download:** Full support for deleting Delivery Challans (`DELETE /api/v1/assets/dcs/{id}/`) and downloading PDFs (`/api/assets/dcs/{id}/download/`).
- **Analytical Dashboard Header:** Includes a live `DCAnalytics` summary banner displaying Total DCs, Returnable vs Non-Returnable metrics, Monthly output, and visual ratio bar.

### B. Purchases & Telegram Bot (`/purchase`)

- **Ingestion Channel:** Telegram bot (`bop-telegram-bot`) listens for receipt photos/documents.
- **OCR Processing:** Converts receipt images into structured purchase records and posts to `PLATFORM_API_URL` (`http://backend:8000`) using `PLATFORM_SERVICE_TOKEN`.
- **Unmark Paid & Payment Lifecycle:** Backend `POST /api/v1/purchase/bills/{id}/unmark-paid/` endpoint and server action `unmarkBillPaidAction` back payment status toggling.
- **Purchase Review & Safety Controls:** Direct confirmation modals for Mark Paid, Unmark Paid, Deactivate Vendor, and Delete Bill. Reusable `DeleteBillWarning` component and standardized formatters (`format.ts`).
- **Design Token Integration:** Rebuilt Purchase AI insights grid using `SectionCard` primitive and token-driven tone highlights (`warning`).

### C. Automation Engine & Routine Scheduling (`/automation`)

- **Recurring Schedules:** Supports `ONCE`, `DAILY`, `WEEKLY`, and `MONTHLY` cadences with automatic `next_run_at` frequency calculation upon execution.
- **File Package Generation:** Package destinations (`downloaded_package`, `auditor_folder`) generate structured `.zip` file bundles stored via `StorageService`. Report destinations (`generate_report`) generate `.csv`/`.pdf`/`.xlsx` files.
- **1-Click Artifact Downloads:** `AutomationRun` records expose `download_url` for direct access to generated file packages.
- **Full Rule Editing:** `EditRuleDialog` component (`edit-rule-dialog.tsx`) and `PATCH /api/v1/automation/rules/{id}/` API endpoint allowing operators to modify rule metadata, cadence, trigger schedule, sources, and required tags at any time.

### D. Document Management (`/dms`)

- **Extended Categories:** Categories list expanded to `Invoice`, `Policy`, `PO`, `Report`, `Purchase Bill`, `Contract`, `Correspondence`, and `Other` across frontend (`dms-constants.ts`) and backend (`DocumentCategory` in `models/document.py`).
- **Custom File Dropzone:** Clean drag-and-drop file dropzone displaying selected file name and size (`DC_28_2026-27-1.pdf (0.45 MB)`) without native browser default "Browse..." button text.
- **Multipart Tags List Extraction:** `DocumentViewSet` `create` and `partial_update` endpoints extract `request.data.getlist("tags")` for multi-tag upload processing.
- **AI Summarization:** Upload, store, categorize, and AI-summarize company documents (`src/lib/dms.ts`). Document approval workflows simplified to `ACTIVE` and `ARCHIVED`.

### E. Inventory (`/inventory`)

- Track items, stock receipts, and stock issues. Low-stock checks removed for single-operator simplicity.

### F. System Maintenance (`/maintenance`)

- System diagnostics, health checks (`/healthz`), tenant configuration, and AI usage monitoring.

### G. Shell & Resilience (`(platform)`)

- **Error Boundary:** Platform-wide `error.tsx` catches exceptions gracefully with `EmptyState` fallback UI.
- **Dashboard Freshness:** Greeting renders dynamic `dataAsOf` relative timestamp ("Updated Xm ago") with smooth crossfade.

---

## 3. Key File Locations

| Component                    | File Path                                                          |
| :--------------------------- | :----------------------------------------------------------------- |
| **Automation Rules UI**      | `apps/web/src/app/(platform)/automation/rules-table.tsx`           |
| **Automation Edit Dialog**   | `apps/web/src/app/(platform)/automation/edit-rule-dialog.tsx`      |
| **Automation Create Dialog** | `apps/web/src/app/(platform)/automation/create-rule-dialog.tsx`    |
| **Automation Actions**       | `apps/web/src/app/(platform)/automation/actions.ts`                |
| **Automation Service (Py)**  | `platform/automation/services.py`                                  |
| **Automation API (Views)**   | `platform/automation/views.py`                                     |
| **DC Service (Backend)**     | `modules/assets/backend/services/dc.py`                            |
| **DC Views (DRF API)**       | `modules/assets/backend/api/dc_views.py`                           |
| **DC Model (Django)**        | `modules/assets/backend/models/dc.py`                              |
| **DC Serializers**           | `modules/assets/backend/serializers/dc.py`                         |
| **DC Template (Word)**       | `modules/assets/backend/templates/dc_template.docx` / `DC 26.docx` |
| **DC Page (Frontend)**       | `apps/web/src/app/(platform)/assets/page.tsx`                      |
| **DC Dialog (Frontend)**     | `apps/web/src/app/(platform)/assets/generate-dc-dialog.tsx`        |
| **DC Table (Frontend)**      | `apps/web/src/app/(platform)/assets/dc-table.tsx`                  |
| **DC Analytics (Frontend)**  | `apps/web/src/app/(platform)/assets/dc-analytics.tsx`              |
| **DC Server Actions**        | `apps/web/src/app/(platform)/assets/actions.ts`                    |
| **Purchase Unmark Paid**     | `modules/purchase/backend/api/bill_views.py`                       |
| **Purchase Formatters**      | `apps/web/src/app/(platform)/purchase/format.ts`                   |
| **Delete Bill Warning**      | `apps/web/src/app/(platform)/purchase/delete-bill-warning.tsx`     |
| **DMS Upload Dialog**        | `apps/web/src/app/(platform)/dms/upload-dialog.tsx`                |
| **DMS Constants**            | `apps/web/src/lib/dms-constants.ts`                                |
| **DMS Model (Backend)**      | `modules/documents/backend/models/document.py`                     |
| **Platform Error Boundary**  | `apps/web/src/app/(platform)/error.tsx`                            |
| **CI/CD Workflow**           | `.github/workflows/ci.yml`                                         |
| **Auth Proxy Route**         | `apps/web/src/app/api/auth/login/route.ts`                         |
| **Server API Fetcher**       | `apps/web/src/lib/api/server.ts`                                   |
| **API Response Envelope**    | `apps/web/src/lib/api/envelope.ts`                                 |
| **DMS Library**              | `apps/web/src/lib/dms.ts`                                          |
| **Telegram Bot Service**     | `services/telegram-bot/main.py`                                    |
| **Docker Composition**       | `docker-compose.yml`                                               |

---

## 4. Key Commands for AI / Operators

### Docker Services

```bash
# Restart Django Backend (required after Python code edits)
docker restart bop-backend

# Restart Telegram Bot Service
docker restart bop-telegram-bot

# Run Django Migrations inside container
docker exec bop-backend python /app/manage.py makemigrations
docker exec bop-backend python /app/manage.py migrate
```

### Web Application

```bash
# Development server
pnpm --filter web dev

# Production build & TypeScript check
pnpm --filter web build
```

---

## 5. Important Gotchas & Conventions

- **Gunicorn Container Hot-Reload:** Python code edits in mounted volumes do **not** auto-reload inside `bop-backend`. Always run `docker restart bop-backend` after modifying Python files.
- **DRF Queryset Tenant Filtering:** `get_queryset()` in viewsets must account for superusers or users without explicit `tenant_id` bound (`user.tenant_id is None`), returning `.all()` rather than `.none()` to avoid 404s on retrieval/deletion.
- **Server Action Error Return:** Wrap server actions in try/catch returning `{ success: boolean, error?: string, data?: T }`.
- **Pre-Commit / Prettier:** Linting pre-commit hooks are disabled (`repos: []` in `.pre-commit-config.yaml`, `*` in `.prettierignore`) to prevent un-formatted git commit blocks.
