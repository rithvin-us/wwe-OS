# Module Technical Specs

Deep, 20-point engineering specs (functional/non-functional requirements
through future scalability) for the modules named in the Stage-2-and-beyond
brief. Distinct from `docs/modules/*.md`, which are the business-facing
blueprints (purpose, KPIs, permissions) written earlier — these specs are
the technical layer underneath them.

**Read `_shared-conventions.md` first** — error handling, security, testing,
deployment, and API conventions are documented once there; every spec below
references it instead of repeating it.

| Spec                                                         | Status                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [document-ingestion.md](document-ingestion.md)               | Partially built (Telegram channel)                                                 |
| [workflow-engine.md](workflow-engine.md)                     | Scoped down to v1 pattern; not a separate build                                    |
| [purchase.md](purchase.md)                                   | Core ingestion + review built and tested                                           |
| [document-management.md](document-management.md)             | Not built                                                                          |
| [reports.md](reports.md)                                     | Not built                                                                          |
| [ai-layer.md](ai-layer.md)                                   | Not built (contains a model-naming caveat — read before implementing)              |
| [executive-dashboard.md](executive-dashboard.md)             | Shell built, data not wired                                                        |
| [mobile-application.md](mobile-application.md)               | Not built                                                                          |
| [integration-layer.md](integration-layer.md)                 | Partially built (Telegram; SSO/email/webhooks not built)                           |
| [production-infrastructure.md](production-infrastructure.md) | Local dev built and verified; production not executed                              |
| [testing-strategy.md](testing-strategy.md)                   | Unit/integration/API built (40 tests); performance/load/security testing not built |
| [hr-integration-strategy.md](hr-integration-strategy.md)     | Plan only — no discovery of the real HR app has happened yet                       |

For the overall build order, dependency graph, risk/cost/time estimates, and
readiness checklist: `docs/roadmap/development-roadmap.md`.
