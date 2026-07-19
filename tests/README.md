# Tests (cross-cutting)

Platform-wide test suites that span module boundaries:

- End-to-end scenarios across apps + backend
- Integration tests of platform contracts (auth, tenancy, workflow, events)
- Load/performance test definitions

Unit and module-scoped tests live inside each module (`modules/*/backend/tests`)
and each service (`services/*/tests`) — not here.
