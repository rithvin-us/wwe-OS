# Modules

Business capability modules. **All business logic lives here** — and only here.

| Module         | Domain                                                    |
| -------------- | --------------------------------------------------------- |
| `hr/`          | HR automation (first module; existing repo migrates here) |
| `purchase/`    | Purchase orders and procurement                           |
| `dms/`         | Document management system                                |
| `inventory/`   | Stock and inventory control                               |
| `vendors/`     | Vendor/supplier management                                |
| `contracts/`   | Contract lifecycle                                        |
| `assets/`      | Asset registry and tracking                               |
| `maintenance/` | Maintenance requests and scheduling                       |
| `visitors/`    | Visitor management                                        |
| `finance/`     | Finance operations                                        |
| `analytics/`   | Cross-module analytics                                    |
| `reports/`     | Report generation                                         |
| `chatbot/`     | Conversational assistant                                  |

**Module contract**

- Modules depend on `platform/` and `packages/`; never on other modules directly.
  Cross-module needs go through platform contracts or domain events.
- Auth, users, permissions, workflow, notifications, audit, search, storage:
  always consumed from the platform, never reimplemented.
- Standard layout per module: `backend/` (api, controllers, services,
  repositories, models, schemas, serializers, validators, events, tasks,
  permissions, tests), `frontend/`, `config/`, `docs/`.
