# Database

PostgreSQL is the system of record. This directory owns everything about its
shape and lifecycle.

| Folder        | Responsibility                                                              |
| ------------- | --------------------------------------------------------------------------- |
| `migrations/` | Versioned schema migrations (single ordered history for the whole platform) |
| `seed/`       | Seed data: reference data, demo tenants, local fixtures                     |
| `schemas/`    | Schema documentation / ERDs per domain                                      |
| `backups/`    | Backup & restore procedures and scripts (never actual dumps in git)         |
| `docs/`       | Database conventions: naming, indexing, tenancy strategy                    |

**Conventions**

- Every tenant-owned table carries a tenant discriminator (see `platform/tenancy`).
- Modules own their tables under a module prefix; platform tables under `platform_`.
- All schema changes go through migrations — no manual DDL.
