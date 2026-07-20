# Shared Conventions

Every module spec in this directory references this document instead of
repeating it. These patterns are already implemented in the platform kernel
(Stage 1) and proven in the Purchase module (Stage 2) — new modules reuse
them, never reinvent them.

## Error handling

Every API error, regardless of module, has this shape:

```json
{ "success": false, "error": { "code": "validation_error", "message": "…", "details": {…} } }
```

| Status | `code`                  | Raised by                                                                                       |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------- |
| 401    | `authentication_failed` | Missing/invalid JWT or service token                                                            |
| 403    | `permission_denied`     | Authenticated, lacks the permission                                                             |
| 404    | `not_found`             | Resource absent or outside the caller's tenant                                                  |
| 409    | `conflict`              | State conflict (duplicate, already-reviewed, etc.)                                              |
| 422    | `validation_error`      | Field validation failed (both DRF's own and the platform's `ValidationError` normalize to this) |
| 429    | `rate_limited`          | Throttle or account lockout                                                                     |
| 500    | `internal_error`        | Unhandled exception (logged, never leaks a traceback to the client)                             |

Implementation: `platform/shared/exceptions.py` (`standard_exception_handler`,
`shared.exceptions.*` error classes). Modules raise these from services; views
never construct error responses by hand.

## Security

- **Two authentication schemes only**: `PlatformJWTAuthentication` (human
  users, `Authorization: Bearer <token>`) and `ServiceTokenAuthentication`
  (ingestion channels, `Authorization: Service <token>`,
  `platform/shared/service_auth.py`). A view uses exactly one.
- **Authorization**: `shared.permissions.HasPlatformPermission` reads a
  view's `required_permissions` and checks the caller's effective
  permissions (roles, with inheritance). Superusers bypass. Service actors
  never carry platform permissions — they only reach endpoints that opted
  into `ServiceTokenAuthentication` in the first place.
- **Tenant isolation**: every tenant-owned model extends
  `shared.models.TenantOwnedModel`; its manager filters to the current
  tenant automatically. Never write a manual `tenant=` filter as the only
  isolation guard — rely on the manager, verify with a cross-tenant test.
- **Rate limiting**: `DEFAULT_THROTTLE_CLASSES` covers every endpoint by
  default; endpoints needing a distinct budget (login, password reset,
  ingestion) declare their own `ScopedRateThrottle` subclass and register a
  rate in `REST_FRAMEWORK.DEFAULT_THROTTLE_RATES`.
- **Secrets**: environment variables only (`config/env.py`), never
  hardcoded, never committed. `.env.example` documents every variable a
  service reads.
- **CORS / CSRF / headers**: configured once in `platform/config/settings.py`
  and inherited by every app — modules never add their own.

## Permission registration

A module wanting its own permission codes (e.g. `purchase.bill.review`)
registers them the same way `platform/permissions` does: a `registry.py`
listing `PermissionDef`s, synced into the shared `Permission` table via a
`post_migrate` hook in the module's `apps.py`. See
`modules/purchase/backend/permissions/` for the reference implementation.
Owner automatically receives every permission that exists at seed time — see
the `MODULE_APPS` ordering note in `platform/config/settings.py`.

## Events

Cross-capability reactions go through `shared.events.publish`/`subscribe` —
never direct imports between modules, and never from platform into a module.
A module owns its own event-name constants (its own `events/registry.py`);
`shared.events` is transport only. See
`modules/purchase/backend/events/` for the reference implementation
(a `subscribers.py` wiring the module's events into `audit`, imported once
from `apps.py.ready()`).

## Testing strategy

- **Framework**: pytest + pytest-django + DRF's `APIClient`, against sqlite
  (`config.settings_test` — fast, deterministic, no external services).
- **Structure**: `<module>/backend/tests/`, its own `conftest.py` (a module's
  tests never import another module's or the platform's private fixtures —
  same "no direct dependency" rule as runtime code).
- **What every module's suite must cover**: the happy path, permission
  enforcement (with vs without the role), tenant isolation (a second tenant
  can't see the first's data), and that state-changing actions are audited.
- **Discovery**: `platform/pytest.ini` `testpaths` includes `../modules`, so
  `cd platform && pytest` runs the kernel's tests and every module's in one
  pass.
- **Before "done"**: `ruff check`, `python manage.py check`,
  `makemigrations --check --dry-run`, `pytest`, `manage.py spectacular` (0
  warnings), `manage.py check --deploy` (0 issues) — all green. This is the
  Stage 1/2 verification gate; every future stage repeats it.

## Deployment

- Local: `docker compose up -d --build` — Postgres, Redis, Mailpit, the
  Django backend, and any service (e.g. `telegram-bot`) that has a
  `docker-compose.yml` entry. Each service has its own `Dockerfile`.
- Backend: Gunicorn behind the platform's `entrypoint.sh` (migrate → seed →
  collectstatic → serve), health at `/healthz`, readiness at `/readyz`.
- Production target: Render (backend + services), Vercel (frontend), managed
  PostgreSQL, Cloudflare Tunnel (AI engine, initially).
- Config via environment only — `.env.example` is the single source of what
  a deployment needs to set.

## API conventions

- Base path `/api/v1/`, one router per module mounted in
  `platform/config/urls.py`.
- List responses paginated (`shared.pagination.StandardResultsSetPagination`)
  with `meta: {count, page, pages, page_size, next, previous}`.
- Filtering/search/ordering via `django-filter` + DRF's `SearchFilter`/
  `OrderingFilter` — declared per-viewset (`filterset_fields`,
  `search_fields`, `ordering_fields`), never hand-rolled query parsing.
- OpenAPI schema auto-generated (`drf-spectacular`); every non-standard
  authentication class gets an `OpenApiAuthenticationExtension` so the docs
  stay accurate (see `PlatformJWTScheme`, `ServiceTokenScheme`).
