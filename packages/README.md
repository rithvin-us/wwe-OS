# Packages

Reusable frontend/TypeScript packages shared by every app and module frontend.
All are pnpm workspace members published under the `@bop/` scope (internal).

| Package          | Responsibility                                   |
| ---------------- | ------------------------------------------------ |
| `ui/`            | Reusable UI components                           |
| `sdk/`           | Typed API client for the backend                 |
| `shared-types/`  | Shared TypeScript types/contracts                |
| `utils/`         | Generic helpers (dates, formatting, etc.)        |
| `config/`        | Shared tool configs (eslint, tsconfig, prettier) |
| `design-system/` | Design tokens, themes, primitives                |

Rule: if two apps need it, it belongs here — never copy-pasted.
