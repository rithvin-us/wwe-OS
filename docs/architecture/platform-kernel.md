# Platform Kernel (Stage 1)

The `platform/` backend is the kernel every business module depends on. It is a
Django project exposing a REST API. It contains **no business logic** — only
capabilities: identity, tenancy, RBAC, audit, notifications, and the shared
foundation they are built on.

## Capabilities (Django apps)

| App             | Responsibility                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared`        | Base model, repository/service/serializer/validator bases, event bus, pagination, error handling, renderer, DRF permission, request context. Abstract only — no tables. |
| `tenancy`       | `Tenant`, `Subscription`, `CompanyProfile`; tenant resolution middleware; tenant-scoped manager.                                                                        |
| `users`         | The generic `User` (identity only — no HR fields). Email is the login identifier.                                                                                       |
| `auth`          | JWT auth, sessions/devices, login attempts, lockout, password reset, email verification.                                                                                |
| `permissions`   | Granular permission catalog (code-defined, DB-synced).                                                                                                                  |
| `roles`         | Enterprise RBAC: system + custom roles, inheritance, assignment.                                                                                                        |
| `audit`         | Immutable, append-only audit trail, wired to the event bus.                                                                                                             |
| `notifications` | Generic multi-channel notification engine (in-app, email; Telegram/webhook declared for later).                                                                         |

## Layering

```
HTTP → DRF View/ViewSet → Serializer (validate) → Service (rules) → Repository/Manager → Model → PostgreSQL
                                                      │
                                                      └── publish() → Event bus → subscribers (audit, …)
```

- **Views** stay thin: parse, delegate, respond.
- **Services** hold capability rules and publish events.
- **Managers** enforce soft-delete and tenant scoping transparently.
- Every model derives from `shared.models.BaseModel` (UUID PK, `created_at`,
  `updated_at`, soft delete). Tenant-owned data derives from `TenantOwnedModel`.

## Event flow

The in-process event bus (`shared/events.py`) is the only channel for
cross-capability reactions. Capabilities publish; others subscribe. Modules
(Stage 2+) subscribe the same way and never import each other.

```
AuthService.login()  ── publish(user.logged_in) ──►  audit subscriber ──► AuditLog
UserService.create() ── publish(user.created)   ──►  audit subscriber ──► AuditLog
RoleService.assign() ── publish(role.assigned)  ──►  audit subscriber ──► AuditLog
```

Dispatch is synchronous today; the publish/subscribe contract lets a Celery/
Redis transport replace it later without touching publishers or subscribers.

## Tenant architecture

Row-level multi-tenancy on a shared database:

- Every tenant-owned row carries a `tenant` FK (`TenantOwnedModel`).
- The current tenant is resolved per request — from the JWT user
  (`PlatformJWTAuthentication`) or a session user (`TenantMiddleware`) — and
  stored in a thread-local (`shared/context.py`).
- `TenantManager` filters every query to the current tenant automatically, and
  `save()` stamps it. Isolation is enforced without each query remembering to
  filter. (See `tests/test_tenancy.py`.)

Schema-per-tenant is a future option; nothing in the model layer blocks it.

## Data model (summary)

```
Tenant 1─1 Subscription
Tenant 1─1 CompanyProfile
Tenant 1─* User
User  *─* Role  (through UserRole)
Role  *─* Permission
Role  0..1─* Role (parent → children, inheritance)
User  1─* UserSession / LoginAttempt / PasswordResetToken / EmailVerificationToken
Tenant/User 1─* AuditLog
Tenant/User 1─* Notification
```

## Standards enforced

UUID PKs · `created_at`/`updated_at` everywhere · soft delete (archive, not
erase) · FK constraints and DB indexes · standard response envelope · consistent
error shape · rate limiting · OpenAPI generation · secrets from environment only.
