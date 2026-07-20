# Packages

Reusable frontend/TypeScript packages shared by every app and module frontend.
All are pnpm workspace members published under the `@bop/` scope (internal).

| Package          | Responsibility                                                |
| ---------------- | ------------------------------------------------------------- |
| `design-system/` | Design tokens (color, type, layout metrics) — source of truth |
| `theme/`         | Theme runtime: light/dark provider and hooks                  |
| `ui/`            | Component library (shadcn-based + platform primitives)        |
| `icons/`         | Icon gate over Lucide — the only icon import path             |
| `charts/`        | Themed chart layer over Recharts                              |
| `sdk/`           | Typed API client for the backend                              |
| `shared-types/`  | Shared TypeScript types/contracts                             |
| `utils/`         | Generic helpers (dates, formatting, etc.)                     |
| `config/`        | Shared tool configs (eslint, tsconfig, prettier)              |

Rule: if two apps need it, it belongs here — never copy-pasted.
