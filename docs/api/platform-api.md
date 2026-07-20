# Platform API

Base path: `/api/v1/`. Authentication: `Authorization: Bearer <access token>`.

## Conventions

- **Success (single):** `{ "success": true, "data": { … } }`
- **Success (list):** `{ "success": true, "data": [ … ], "meta": { count, page, pages, page_size, next, previous } }`
- **Error:** `{ "success": false, "error": { "code", "message", "details" } }`
- **Pagination:** `?page=`, `?page_size=` (max 200).
- **Filtering/search/ordering:** `?<field>=`, `?search=`, `?ordering=` (prefix `-` to reverse).
- **Rate limiting:** per-user, per-anon, and stricter scopes on login and
  password reset. Exceeding a limit returns `429` with the standard error shape.

## Health

| Method | Path       | Purpose                                |
| ------ | ---------- | -------------------------------------- |
| GET    | `/healthz` | Liveness (process up)                  |
| GET    | `/readyz`  | Readiness (database + cache reachable) |

## OpenAPI

| Path              |                  |
| ----------------- | ---------------- |
| `/api/v1/schema/` | OpenAPI 3 schema |
| `/api/v1/docs/`   | Swagger UI       |
| `/api/v1/redoc/`  | ReDoc            |

## Endpoints

**Auth** — `/api/v1/auth/`
`register/` · `login/` · `refresh/` · `logout/` · `logout-everywhere/` ·
`password/reset/` · `password/reset/confirm/` · `password/change/` ·
`email/verify/` · `me/`

**Users** — `/api/v1/users/` (CRUD; `users.read` / `users.write`); `me/` for the caller.

**Roles** — `/api/v1/roles/` (CRUD; `roles.read` / `roles.manage`);
`{id}/permissions/` (PUT) · `{id}/assign/` (POST).

**Permissions** — `/api/v1/permissions/` (read-only catalog; `permissions.read`).

**Tenancy** — `/api/v1/tenancy/company-profile/` (the caller's tenant profile;
`settings.view` / `settings.manage`).

**Audit** — `/api/v1/audit/` (read-only; `audit.view`); `{id}/archive/` (`audit.archive`).

**Notifications** — `/api/v1/notifications/` (own notifications; send needs
`notifications.send`); `{id}/read/` · `{id}/archive/` · `unread-count/`.

## Errors

| Status | `code`                  | When                                               |
| ------ | ----------------------- | -------------------------------------------------- |
| 401    | `authentication_failed` | Missing/invalid credentials                        |
| 403    | `permission_denied`     | Authenticated but lacks the permission             |
| 404    | `not_found`             | Resource absent or outside the tenant              |
| 409    | `conflict`              | State conflict (e.g. duplicate slug)               |
| 422    | `validation_error`      | Field validation failed (`details` carries fields) |
| 429    | `rate_limited`          | Throttle or account lockout                        |
