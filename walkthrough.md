# Project Walkthrough & Commands Reference

## Project Analysis

This repository hosts the **Business Operations Platform**, a modular monorepo that supports multiple business applications leveraging a shared platform kernel.

### Architecture Breakdown

- **Frontend / Apps (`apps/`, `packages/`)**: Built using Node.js and TypeScript. Uses `pnpm` for workspace management.
- **Backend / Platform & Modules (`platform/`, `modules/`)**: Built using Python 3.12+. Strict separation ensures business logic remains in `modules/` and shared capabilities are in `platform/`.
- **Services (`services/`)**: Independent deployable microservices (e.g., workers, bots, AI engine).
- **Infrastructure (`infrastructure/`, `database/`)**: Relies on PostgreSQL, Redis, Mailpit, and Docker Compose for local orchestration.

## Useful Commands

### Setup & Initialization

- `pnpm install` - Install frontend and workspace dependencies.
- `pip install --group dev` - Install backend development dependencies.
- `pre-commit install` - Setup git pre-commit hooks.

### Local Infrastructure

- `docker compose up -d` - Start local Postgres, Redis, and Mailpit.
- `docker compose down` - Stop local infrastructure.

### Linting & Formatting

- `pnpm lint` - Run ESLint across the workspace.
- `pnpm format` - Run Prettier to format TS/JS files.
- `ruff check .` - Run Ruff linter on Python files.
- `ruff format .` - Run Ruff formatter on Python files.
- `pre-commit run --all-files` - Run all configured hooks manually.

### Testing

- `pytest` - Run all Python tests in the workspace.

### Running Applications

- `pnpm --filter <app-name> dev` - Run a specific frontend app (e.g., `web`). Currently running: `pnpm --filter web dev`.
