# RBAC & Permission Matrix

## Model

- **Permission** — a granular, code-defined capability (e.g. `users.write`).
  The catalog lives in `permissions/registry.py` and is synced to the database
  on every migrate. Permissions are read-only over the API.
- **Role** — a named bundle of permissions. System roles (`tenant = null`) ship
  with the platform; custom roles belong to a tenant. A role may have a **parent**
  and inherits its permissions (single inheritance).
- **UserRole** — assigns a role to a user.

A user's **effective permissions** = the union of permission codes across all
their roles, including inherited ones (`RoleService.effective_permission_codes`).
Superusers bypass all checks.

## Enforcement

`shared.permissions.HasPlatformPermission` reads a view's `required_permissions`
(a code, or an action/method → code map) and checks the user's effective
permissions. Every viewset declares what it needs; business modules reuse the
same mechanism.

## Permissions

| Code                                             | Category            |
| ------------------------------------------------ | ------------------- |
| `users.read`, `users.write`, `users.invite`      | Users               |
| `roles.read`, `roles.manage`, `permissions.read` | Roles & permissions |
| `audit.view`, `audit.archive`                    | Audit               |
| `notifications.read`, `notifications.send`       | Notifications       |
| `settings.view`, `settings.manage`               | Settings            |
| `dashboard.view`                                 | Dashboard           |

## System roles (seeded)

| Permission         | Owner | Administrator | Member |
| ------------------ | :---: | :-----------: | :----: |
| users.read         |   ✓   |       ✓       |        |
| users.write        |   ✓   |       ✓       |        |
| users.invite       |   ✓   |       ✓       |        |
| roles.read         |   ✓   |       ✓       |        |
| roles.manage       |   ✓   |       ✓       |        |
| permissions.read   |   ✓   |       ✓       |        |
| audit.view         |   ✓   |       ✓       |        |
| audit.archive      |   ✓   |               |        |
| notifications.read |   ✓   |       ✓       |   ✓    |
| notifications.send |   ✓   |       ✓       |        |
| settings.view      |   ✓   |       ✓       |   ✓    |
| settings.manage    |   ✓   |       ✓       |        |
| dashboard.view     |   ✓   |       ✓       |   ✓    |

Owner always receives the full catalog (kept in sync automatically). Tenants can
create custom roles and set their permissions via `PUT /api/v1/roles/{id}/permissions/`.
