# Module · hr

HR automation: employees, leave, attendance, onboarding. First module — the existing HR Automation repository will be migrated here. Do not add new code before migration.

## Structure

```
backend/
  api/            HTTP routing layer (framework endpoints)
  controllers/    Request orchestration, no domain rules
  services/       Domain/business logic (the core)
  repositories/   Data access, one per aggregate
  models/         ORM / persistence models
  schemas/        Request/response schemas (DTOs)
  serializers/    Output shaping
  validators/     Input and domain validation
  events/         Domain events emitted/consumed
  tasks/          Background jobs (executed by services/worker)
  permissions/    Permission declarations registered with platform
  tests/          Module test suite
frontend/         Module UI, mounted by apps
config/           Module configuration and defaults
docs/             Module documentation
```

## Rules

- Business logic stays in `backend/services`. Controllers stay thin.
- Identity, authz, workflow, notifications, audit, files: use `platform/`.
- No direct imports from other modules — platform contracts or events only.
