# 05. Development Guide & Standards

## Monorepo Folder Structure

```text
wwe OS/
├── apps/
│   └── web/                   # Next.js 16 App Router frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/    # Login, register, auth routes
│       │   │   └── (platform)/# Protected platform routes (assets, inventory, purchase, dms, maintenance, reports)
│       │   ├── components/    # Reusable UI components
│       │   ├── config/        # App navigation & module registry
│       │   └── lib/           # API fetch helpers & constants
├── modules/                   # Django business domain modules
│   ├── assets/                # Assets & Delivery Challans backend
│   ├── inventory/             # Inventory backend
│   ├── purchase/              # Purchase backend
│   ├── dms/                   # Document Management System backend
│   └── hr/                    # HR backend (in progress)
├── platform/                  # Django Platform Kernel (no business logic)
│   ├── shared/                # Base models, middleware, context, exceptions
│   ├── tenancy/               # Tenant models & scoping manager
│   ├── storage/               # StorageService & provider abstractions
│   ├── ai/                    # AIService gateway & prompt library
│   ├── search/                # SearchService & FTS adapters
│   ├── reporting/             # ReportService & format renderers
│   ├── audit/                 # Append-only audit trail
│   ├── permissions/           # Permission registry
│   └── roles/                 # System & custom RBAC roles
├── services/                  # Standalone background microservices
│   └── telegram-bot/          # Telegram bill ingestion bot (Python 3.12)
├── packages/                  # Shared monorepo packages
│   ├── ui/                    # UI component library (Radix UI, Tailwind)
│   ├── icons/                 # Lucide icons package (@bop/icons)
│   └── theme/                 # Dark/Light theme tokens & context
├── docs/                      # System documentation & Architecture Handbook
└── docker-compose.yml         # Local development infrastructure setup
```

---

## Coding Standards

### Python / Django

- **Typing:** Strict type hints on public methods (`def generate_dc(...) -> DeliveryChallan:`).
- **Exceptions:** Use custom exceptions from `shared.exceptions` (`NotFoundError`, `ValidationError`, `ConflictError`).
- **Imports:** Absolute imports preferred (`from shared.models import TenantOwnedModel`).

### TypeScript / Next.js

- **Components:** React 19 Function Components with explicit Props interfaces.
- **Styling:** Tailwind CSS v4 utility classes with CSS variables defined in `@bop/theme`.
- **Icons:** Import icons strictly from `@bop/icons` (e.g. `import { Plus } from "@bop/icons"`).

---

## Stable Components ("Do Not Touch")

Unless fixing a verified bug or extending capabilities via documented interfaces, the following core components are considered stable:

1. **`platform/storage/`:** Storage abstraction provider interfaces.
2. **`platform/ai/`:** AI Gateway routing and token accounting.
3. **`platform/shared/context.py` & `middleware.py`:** Thread-local tenant and request context management.
4. **`platform/auth/`:** JWT authentication, token rotation, and password hashing logic.
5. **`packages/theme/`:** Global color palette variables and theme provider setup.

---

## Testing & Verification Commands

### Backend Tests (Django)

```bash
# Run all backend tests inside Docker container
docker exec bop-backend python /app/manage.py test

# Run tests for specific modules
docker exec bop-backend python /app/manage.py test assets.backend
docker exec bop-backend python /app/manage.py test purchase.backend
```

### Frontend Verification (Next.js)

```bash
# Run Next.js production build and TypeScript validation
pnpm --filter web build

# Run ESLint check
pnpm --filter web lint
```
