# WWE OS Architecture Handbook

Welcome to the official Architecture Handbook for **WWE OS** (Business Operations Platform).

This handbook serves as the single source of truth for software engineers, platform architects, and AI coding assistants. It documents system design, platform services, integration constraints, development standards, operational workflows, and deployment topology.

---

## Handbook Structure

| Chapter                                                                        | Title & Description                 | Key Topics                                                                                                       |
| :----------------------------------------------------------------------------- | :---------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| [**01-project-overview.md**](./01-project-overview.md)                         | **Project Overview & Scope**        | System purpose, in-scope vs out-of-scope features, high-level architecture diagram, current development stage.   |
| [**02-platform-services.md**](./02-platform-services.md)                       | **Platform Shared Services**        | Storage, AI Gateway, Search, Reporting, Audit, Notifications, Workflow, Authentication, Observability.           |
| [**03-business-modules.md**](./03-business-modules.md)                         | **Business Modules**                | Delivery Challans & Assets, Purchases & Telegram Bot, Inventory, DMS, Maintenance.                               |
| [**04-integration-rules.md**](./04-integration-rules.md)                       | **Integration Rules & Constraints** | Architectural boundary rules, service consumption rules, multi-tenancy rules.                                    |
| [**05-development-guide.md**](./05-development-guide.md)                       | **Development Guide & Standards**   | Coding standards, folder structure, testing commands, stable "Do Not Touch" components.                          |
| [**06-environment-and-dependencies.md**](./06-environment-and-dependencies.md) | **Environment & Dependencies**      | Required environment variables, external services (Cloudflare R2, OpenAI, Anthropic, Telegram, Postgres, Redis). |
| [**07-deployment-and-operations.md**](./07-deployment-and-operations.md)       | **Deployment & Operations**         | Render/Vercel/Docker topology, container management commands, deployment steps.                                  |
| [**08-roadmap.md**](./08-roadmap.md)                                           | **Development Roadmap**             | Completed milestones, active single-operator phase, future capability roadmap.                                   |
| [**09-known-gotchas.md**](./09-known-gotchas.md)                               | **Known Gotchas & Troubleshooting** | Gunicorn container reloads, DRF tenant queryset handling, pre-commit configuration, ISP firewall notes.          |
| [**10-ai-assistant-context.md**](./10-ai-assistant-context.md)                 | **AI Assistant Context**            | Concise project summary and rules for LLM coding assistants.                                                     |

---

## Architecture Principles

1. **Kernel vs Business Modules:** The platform kernel (`platform/`) contains zero business logic. It provides reusable shared capabilities (auth, tenancy, storage, AI gateway, audit, search, reporting).
2. **Platform Service Consumption:** Business modules (`modules/*`) MUST consume platform services rather than implementing ad-hoc file storage, authentication, or AI integrations.
3. **Bounded Contexts:** Business modules never import each other directly; cross-module events pass through the shared event bus or API endpoints.
4. **Single-Operator Efficiency:** UI and UX workflows are optimized for speed, clarity, and single-operator administration, suppressing unnecessary multi-step approval gates while preserving underlying security.
