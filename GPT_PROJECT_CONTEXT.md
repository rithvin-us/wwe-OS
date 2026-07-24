# WWE OS — Comprehensive Project Context for GPT / AI Assistants

> **Last Updated:** July 24, 2026  
> **Repository:** `rithvin-us/wwe-OS`  
> **Architecture:** Single-operator Enterprise Business Operations Platform (Monorepo)  
> **Detailed Knowledge Base:** See [GPT_KNOWLEDGE_BASE.md](file:///e:/w/wwe%20OS/GPT_KNOWLEDGE_BASE.md) for full system specifications.

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
- **Purchase Review:** Web platform supports reviewing, confirming, editing, or rejecting incoming bills.

### C. Inventory (`/inventory`)
- Track items, stock receipts, and stock issues. Low-stock checks removed for single-operator simplicity.

### D. Document Management (`/dms`)
- Upload, store, categorize (`CONTRACT`, `INVOICE`, `COMPLIANCE`, `TECHNICAL`), and AI-summarize company documents (`src/lib/dms.ts`). Approval workflows simplified to `ACTIVE` and `ARCHIVED`.

### E. System Maintenance (`/maintenance`)
- System diagnostics, health checks (`/healthz`), tenant configuration, and AI usage monitoring.

---

## 3. Key File Locations

| Component | File Path |
| :--- | :--- |
| **DC Service (Backend)** | `modules/assets/backend/services/dc.py` |
| **DC Views (DRF API)** | `modules/assets/backend/api/dc_views.py` |
| **DC Model (Django)** | `modules/assets/backend/models/dc.py` |
| **DC Serializers** | `modules/assets/backend/serializers/dc.py` |
| **DC Template (Word)** | `modules/assets/backend/templates/dc_template.docx` / `DC 26.docx` |
| **DC Page (Frontend)** | `apps/web/src/app/(platform)/assets/page.tsx` |
| **DC Dialog (Frontend)** | `apps/web/src/app/(platform)/assets/generate-dc-dialog.tsx` |
| **DC Table (Frontend)** | `apps/web/src/app/(platform)/assets/dc-table.tsx` |
| **DC Analytics (Frontend)** | `apps/web/src/app/(platform)/assets/dc-analytics.tsx` |
| **DC Server Actions** | `apps/web/src/app/(platform)/assets/actions.ts` |
| **Auth Proxy Route** | `apps/web/src/app/api/auth/login/route.ts` |
| **Server API Fetcher** | `apps/web/src/lib/api/server.ts` |
| **API Response Envelope** | `apps/web/src/lib/api/envelope.ts` |
| **DMS Library** | `apps/web/src/lib/dms.ts` |
| **Telegram Bot Service** | `services/telegram-bot/main.py` |
| **Docker Composition** | `docker-compose.yml` |

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
