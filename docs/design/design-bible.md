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

**Semantic colors** (business data state — a KPI trending up, a bill
confirmed/rejected — distinct from the status language above, which is
reserved for module lifecycle only):

| Role    | Token       | Light                   | Dark                  |
| ------- | ----------- | ----------------------- | --------------------- |
| Success | `--success` | `oklch(0.545 0.13 160)` | `oklch(0.7 0.13 160)` |
| Warning | `--warning` | `oklch(0.565 0.14 75)`  | `oklch(0.76 0.13 80)` |

Light-mode values are darker than they look like they need to be — verified
against real WCAG contrast math (`docs/design/contrast-notes.md` has the
method), not eyeballed. The obvious `oklch(0.58 …)`/`oklch(0.66 …)` choices
measured 3.0–4.0:1 as small text on white, short of the 4.5:1 floor.

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
inputs/buttons `md`. Shadows: `--shadow-xs/sm/md` for resting elevation —
depth is quiet, comes from borders and background steps first. `--shadow-lg`
exists for genuine overlays only (a card's `hover:shadow-sm` when it links
somewhere is as far as resting content ever escalates).

**Stacking** — a named scale, never an arbitrary `z-40`/`z-999`:
`--z-sticky` (20, header/sidebar) · `--z-dropdown` (30) ·
`--z-modal-backdrop` (40) · `--z-modal` (50) · `--z-toast` (60) ·
`--z-tooltip` (70). Radix's portaled components (Dialog, Popover, Sheet,
DropdownMenu, Tooltip) manage their own stacking correctly by portaling to
`body` — this scale is for the shell's own fixed/sticky chrome.

## 6. Components

- Source: `@bop/ui` only. If a pattern appears twice, it becomes a component
  there. **No app-local copies of platform primitives, no duplicate CSS.**
- Platform primitives beyond shadcn: `StatusChip`/`StatusDot`/`STATUS_META`
  (status.tsx), `PageHeader`, `EmptyState`, `DataTable` (data-table.tsx —
  sticky header, sortable, empty-state-first; the one table component).
  Use them — never re-implement.
- **Tags**: `TagPill`/`TagDot`/`TagPicker` (tag-pill.tsx, tag-picker.tsx) are
  the one tagging UI for the whole platform — Purchase, Documents, Assets,
  Contracts, and anything added later all render and edit tags through these,
  never a bespoke per-module chip. Tag color is always one of 5 fixed
  swatches reusing the categorical chart palette (`--chart-1..5` via
  `bg-chart-1..5`) — never a 6th color or free-form hex. A tag reads as a
  small color dot + label, distinct from `Badge` (which carries no color
  choice) and from `StatusChip` (mono/uppercase, reserved for module
  lifecycle status only).
- Toasts: `Toaster` (sonner.tsx), mounted once in `Providers`. Reserved for
  async/global feedback on real mutations (e.g. confirming a bill) — never
  for validation errors, which stay inline at the field.
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

**Source**: `tw-animate-css` (imported once in `apps/web/src/app/globals.css`)
supplies `animate-in`/`animate-out`/`fade-in`/`slide-in-from-*`/`zoom-in-*`
etc. — Radix's `data-[state=open]:animate-in` classes on Dialog/Sheet/
Popover/DropdownMenu/Tooltip/Command only work because this is installed;
without it those classes are silently inert. Don't remove it.

**Tokens** (`packages/design-system/src/tokens.css`): `--duration-fast`
(120ms) / `--duration-base` (180ms) / `--duration-slow` (260ms),
`--ease-out-quart` / `--ease-out-expo`. Use via
`duration-(--duration-base)` and the real Tailwind utilities `ease-out-quart`
/ `ease-out-expo` (confirmed against Tailwind's own `theme.css`: `--ease-*`
is a real namespace, `--duration-*` is not — named durations are always the
parenthesis arbitrary-value form, never a bare `duration-base` class).

**What actually moves**: `transition-colors` on hover/focus (~150ms, product
default). Overlays use Radix's built-in open/close motion via the plugin
above — don't hand-roll dialog/popover animation. Route changes crossfade
(`AppShell`, a keyed remount + `fade-in`) — not React's `<ViewTransition>`,
which needs a canary React build this app doesn't pin (confirmed by checking
the installed package directly). Lists that benefit from it stagger in via
`animationDelay` per index, capped around 40ms/item so five-plus items don't
read as sluggish (`KpiTile` is the reference). No parallax, no scroll
effects, no orchestrated page-load sequences — product register, not brand.

**Reduced motion**: a global rule in `globals.css` collapses all animation/
transition durations to near-zero under `prefers-reduced-motion: reduce`.
Don't add a per-component override; the global rule is the contract.

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
  text, never color-alone signals (chips carry words). Verify with real
  contrast math before shipping a new text color, not by eye —
  `docs/design/contrast-notes.md` has the method and a real example of a
  token pair that looked fine and measured short.
- Keyboard: palette Ctrl/⌘K; every interactive element tabbable, including
  the sidebar's nav links (explicit `focus-visible:ring-*` — don't rely on
  the browser default outline, which is inconsistent with every other
  focus state in the app).

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

---

## 13. Industrial Operations Control Theme (`SYS :: AUTOSYNC`)

Inspired by the industrial operations control plane (`SYS :: AUTOSYNC HR_TERMINAL_V1`), every platform application adheres to these layout & navigation standards:

1. **Sidebar Branding & Grouping:**
   - **Terminal Brand Badge:** Top sidebar brand identifier reads `SYS :: AUTOSYNC` with monospace terminal subtitle (`HR_TERMINAL_V1` / `OPERATIONS_V1`) and brand status dot.
   - **Section Categorization:** Sidebar navigation items are strictly grouped under uppercase monospace section headers (`CORE MODULES`, `INTELLIGENCE`, `OUTPUTS`, `APPS`).
   - **Active Navigation Pill:** Active navigation items render as a soft emerald pill (`bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 font-semibold border-l-2 border-emerald-600`).
   - **Status Footer:** Bottom sidebar renders real-time connectivity status (`W.W.E. CORP · Connected`).

2. **Top Header & Global Controls:**
   - **Breadcrumb & Page Title:** Left header displays current page section breadcrumb.
   - **Live Clock Pill:** Right header displays live date/time status pill (`Sun, 26 Jul, 2026 03:57:43 pm`).
   - **User Session Status:** Displays authenticated user pill (`admin Signed In`) with quick sign-out action.

3. **Page Controls & Workflow Cards:**
   - **Month Stepper Header:** Period-scoped pages feature integrated month stepper control (`[ < ] [ Jul 2026 ] [ > ] ↻`).
   - **Numbered Workflow Cards:** Sequential operational tasks render as numbered step cards (`1 Attendance`, `2 Payroll`, `3 Generate registers`) with clear status pills (`Open grid`, `Pending`).
