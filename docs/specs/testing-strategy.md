# Testing Strategy

**Status: unit + integration + API tests built and passing (40/40).**
Performance, load, and dedicated security testing are not built. This
document is the full testing picture; `_shared-conventions.md` § Testing
strategy is the short version every module spec links to.

## Current state (real, verified)

| Layer                                                   | Status         | Where                                                                                                  |
| ------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| Unit (services, validators)                             | Built, passing | Exercised indirectly through API tests today; no isolated unit-only suite yet — see gap below          |
| Integration (DB + service layer)                        | Built, passing | `platform/tests/`, `modules/purchase/backend/tests/`                                                   |
| API (full request/response cycle)                       | Built, passing | Same suites — `APIClient` against real views, real DB (sqlite)                                         |
| Contract (does the response match the documented shape) | Built, passing | OpenAPI schema generation asserted to produce 0 warnings; individual response shapes asserted in tests |
| Performance                                             | **Not built**  | —                                                                                                      |
| Load                                                    | **Not built**  | —                                                                                                      |
| Dedicated security (fuzzing, penetration-style)         | **Not built**  | Covered indirectly by auth/permission tests, not by dedicated adversarial testing                      |

40 tests, 0 failures, as of Stage 2: 26 platform-kernel tests (auth, RBAC,
tenancy, audit, notifications, health/schema) + 14 purchase-module tests
(ingestion, review). Full gate: `ruff check`, `manage.py check`,
`makemigrations --check`, `pytest`, `manage.py spectacular`,
`manage.py check --deploy` — all green as of this stage; see
`docs/roadmap/development-roadmap.md` for the exact commands and output.

## 1. Functional requirements (of the testing strategy itself)

- Every new capability or module ships with tests covering: happy path,
  permission enforcement, tenant isolation, and audit trail — not
  optionally, as the actual gate before "done" (`CLAUDE.md`).
- A bug found by manual/integration testing gets a regression test before
  the fix is considered complete (this stage's own example: the
  `ServiceActor.pk` throttling crash, found by running the real server, now
  has explicit coverage via the throttle class being exercised in
  `test_ingest.py` rather than silently working only because tests disable
  throttling).

## 2. Non-functional requirements

- The full suite runs in seconds, not minutes (currently ~3s for 40 tests)
  — sqlite + disabled password hashing rounds
  (`PASSWORD_HASHERS = [MD5PasswordHasher]` in `settings_test.py`) keep it
  fast enough to run on every save, not just before commit.
- Tests never depend on execution order or shared mutable state between
  tests (`_clear_cache` autouse fixture resets the cache every test).

## 3–13. (Not applicable — this is a practice document, not a data-owning module)

## 14. Error handling

Tests assert the _documented_ error contract (`_shared-conventions.md`), not
implementation details — e.g. "a validation failure is 422 with
`code: validation_error`," not "this specific exception class was raised."

## 15. Security testing (gap)

**Not built.** What exists today is permission/auth _correctness_ testing
(does the right role get the right access) — genuinely different from
security testing proper (can an attacker bypass these checks, is input
sanitized against injection, are secrets ever logged). Recommended, not yet
scheduled: dependency vulnerability scanning in CI (once CI exists, see
`production-infrastructure.md`), and a periodic manual review against the
OWASP API Security Top 10 once the API surface is larger than two modules.

## 16. Performance testing (gap)

**Not built.** No load has been generated against this system beyond
individual manual requests. Recommended once real usage exists: a baseline
`locust`/`k6` script against the most-hit endpoints (login, dashboard
summary once built, ingestion) to catch regressions before they reach
production — not urgent at single-operator scale, worth having before any
multi-user expansion.

## 17. Deployment (of test infrastructure)

Tests run identically in any environment (`config.settings_test`, no
external services required) — a future CI workflow needs only Python +
`pip install -r requirements-dev.txt`, no Docker/Postgres/Redis dependency
for the test suite itself (those are exercised separately, see
`production-infrastructure.md` § 16).

## 18–20. Mobile, dashboard integration, future scalability

Mobile app tests (component + contract-against-OpenAPI-schema) are
specified in `docs/specs/mobile-application.md` § 16. No dashboard-specific
or scalability implications beyond what's already covered above.
