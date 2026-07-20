# Design Bible — Business Operations Platform

**This document is law.** Every UI change in any app or module starts here.
If a change contradicts the bible, change the bible first (PR + review), then
propagate to `packages/design-system/src/tokens.css`, then to components.
Nothing ships that this document doesn't describe.

The user must never feel they switched applications. One sidebar, one header,
one theme, one command palette, one login. Modules contribute screens —
never chrome, never style.

---

## 1. Identity

An operations control plane: calm, dense-but-breathable, engineered. The
reference class is Linear, Stripe Dashboard, GitHub Enterprise — not consumer
software. Personality enters through **typography** and the **status
language**, never through decoration.

**The signature** is the status language: every module surface (card, page
header, command palette row) carries the same monospace status chip — a 1.5px
square dot plus an uppercase letterspaced label. State reads identically
everywhere. Module cards take a 2px left rail in their status color on hover.
Protect this; it is the platform's face.

## 2. Source of truth

| Layer         | Location                                | Rule                                                                               |
| ------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| Tokens        | `packages/design-system/src/tokens.css` | Every color, radius, shadow, layout metric. **No hardcoded values anywhere else.** |
| Theme runtime | `packages/theme`                        | One `ThemeProvider` (class dark mode, system default).                             |
| Components    | `packages/ui/src/components`            | shadcn-based + platform primitives. Apps import from `@bop/ui/components/*` only.  |
| Icons         | `@bop/icons`                            | Lucide via one gate. **No emoji. No direct lucide imports.**                       |
| Charts        | `@bop/charts`                           | Recharts + `chartPalette`. Charts never define colors.                             |

## 3. Color

Defined in OKLCH. Semantic tokens only — components reference `--primary`,
`--muted-foreground`, etc., never raw values.

| Role    | Token           | Light                         | Dark                    |
| ------- | --------------- | ----------------------------- | ----------------------- |
| Canvas  | `--background`  | `oklch(0.982 0.003 240)`      | `oklch(0.155 0.01 250)` |
| Surface | `--card`        | white                         | `oklch(0.19 0.012 250)` |
| Text    | `--foreground`  | `oklch(0.19 0.015 250)`       | `oklch(0.93 0.005 240)` |
| Brand   | `--primary`     | petrol `oklch(0.45 0.09 215)` | `oklch(0.72 0.09 210)`  |
| Line    | `--border`      | `oklch(0.908 0.006 240)`      | `oklch(0.26 0.012 250)` |
| Danger  | `--destructive` | `oklch(0.55 0.2 25)`          | `oklch(0.65 0.18 25)`   |

**Status colors** (the signature — never repurpose):

| Status          | Token                            | Meaning                |
| --------------- | -------------------------------- | ---------------------- |
| Operational     | `--status-operational` (emerald) | Live and serving users |
| In development  | `--status-building` (amber)      | Actively being built   |
| Planned         | `--status-planned` (slate)       | Designed, not started  |
| Needs attention | `--status-attention` (red)       | Requires intervention  |

Rules: brand petrol is for primary actions and active states only — not for
status, not for illustration. Status colors are for status only. Charts use
`--chart-1..5` exclusively.

## 4. Typography

Three faces, three jobs. Loaded via `next/font` in the app root; exposed as
`--font-sans`, `--font-display`, `--font-mono`.

| Role    | Face                           | Used for                                               | Never for         |
| ------- | ------------------------------ | ------------------------------------------------------ | ----------------- |
| Display | Space Grotesk (`font-display`) | Page titles, big registry numbers, wordmark            | Body text, labels |
| Body    | Inter (`font-sans`)            | Everything by default                                  | —                 |
| Mono    | JetBrains Mono (`font-mono`)   | Status chips, section labels, kbd, IDs, code, versions | Prose             |

Scale: page title `text-2xl font-semibold tracking-tight`; card title
`text-sm font-medium`; body `text-sm`; supporting `text-xs`; mono labels
`text-[10px]–[11px] uppercase tracking-[0.08em–0.12em]`. Numbers in data
contexts always `tabular-nums`.

## 5. Layout

| Metric        | Token                    | Value                                                      |
| ------------- | ------------------------ | ---------------------------------------------------------- |
| Sidebar width | `--layout-sidebar-width` | 264px — fixed, desktop rail + mobile sheet, same component |
| Header height | `--layout-header-height` | 56px — sticky, backdrop blur                               |
| Content       | —                        | `max-w-[1440px]`, `px-4/6/8` responsive, `py-6`            |
| Card grid     | —                        | `gap-4`, `sm:grid-cols-2 xl:grid-cols-3`                   |

Spacing rhythm: Tailwind scale only; section gaps `space-y-8/10`; card
padding `px-5 py-5`. Radius: `--radius: 0.5rem`; cards/dialogs `lg`,
inputs/buttons `md`. Shadows: `--shadow-xs/sm/md` only — elevation is quiet;
hierarchy comes from borders and background steps, not depth.

## 6. Components

- Source: `@bop/ui` only. If a pattern appears twice, it becomes a component
  there. **No app-local copies of platform primitives, no duplicate CSS.**
- Platform primitives beyond shadcn: `StatusChip`/`StatusDot`/`STATUS_META`
  (status.tsx), `PageHeader`, `EmptyState`. Use them — never re-implement.
- Buttons: one primary action per view. `secondary` for the main card action,
  `ghost` for tertiary, `destructive` only for destruction.
- Forms: React Hook Form + Zod, labels always visible, errors as
  `text-xs text-destructive` under the field. Buttons say what they do
  ("Save changes", never "Submit").
- Tables (when they arrive): header `text-xs text-muted-foreground`, rows
  `text-sm`, numeric columns right-aligned `tabular-nums`.
- Every screen renders inside `AppShell` via the `(platform)` layout. Pages
  start with `PageHeader`. No module builds chrome.

## 7. Motion

`transition-colors` on interactive surfaces (~150ms default). No entrance
animations, no parallax, no scroll effects. Radix handles overlay motion.
Respect `prefers-reduced-motion` for anything beyond color transitions.

## 8. Dark mode

Class strategy (`.dark` on `<html>`, set by `@bop/theme`). Every token has a
dark value in `tokens.css` — components are theme-blind. Never use
`dark:` overrides with raw colors; if dark needs adjusting, adjust the token.

## 9. Accessibility

- Icon-only buttons: `aria-label`. Decorative icons: `aria-hidden`.
- Focus: visible everywhere — ring tokens (`focus-visible:ring-*`), never
  `outline-none` without replacement.
- Active nav: `aria-current="page"`.
- Contrast: body text ≥ 4.5:1 in both themes; status colors are labels with
  text, never color-alone signals (chips carry words).
- Keyboard: palette Ctrl/⌘K; every interactive element tabbable.

## 10. Writing

Sentence case everywhere (headings, buttons, labels). Name things by what
users control, not how the system is built. Empty states say what is empty,
why, and what happens next — no apologies, no mood. Errors state what went
wrong and how to fix it. No exclamation marks, no filler, no emoji.

## 11. Anti-patterns (hard fails in review)

- Hardcoded color, radius, shadow, sidebar/header dimension
- Second sidebar/header/login/notification surface — anywhere
- Direct `lucide-react` import, emoji in UI
- Fabricated metrics or fake activity data
- Per-module fonts, palettes, or spacing systems
- Copying a `@bop/ui` component into an app to tweak it

## 12. Change protocol

1. Propose the change **in this file** (PR).
2. On merge, update `tokens.css` / `@bop/ui` to match.
3. `pnpm build` + visual pass in light and dark.
4. Never patch a one-off in an app; the system changes or nothing does.
