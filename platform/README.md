# Platform

Cross-cutting capabilities shared by every module. The platform is the kernel:
identity, tenancy, workflow, notifications, audit, search, storage, billing, AI.

**Rules**

1. Business logic NEVER lives here. It lives only in `modules/`.
2. Every capability here must be reusable by any current or future module.
3. Modules depend on platform. Platform never depends on modules.
4. All platform services are multi-tenant aware from day one.

| Component        | Responsibility                            |
| ---------------- | ----------------------------------------- |
| `auth/`          | Authentication, sessions, tokens, SSO     |
| `users/`         | User identity and profiles                |
| `roles/`         | Role definitions and assignment           |
| `permissions/`   | Permission model and policy checks        |
| `workflow/`      | Generic workflow / approval engine        |
| `notifications/` | Multi-channel notification dispatch       |
| `audit/`         | Immutable audit trail                     |
| `search/`        | Cross-module indexing and search          |
| `storage/`       | File/object storage abstraction           |
| `tenancy/`       | Tenant lifecycle and isolation            |
| `billing/`       | Plans, subscriptions, usage metering      |
| `ai/`            | Shared AI gateway (LLM, embeddings)       |
| `shared/`        | Base classes, common utilities, contracts |
