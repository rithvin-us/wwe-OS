---
name: WWE OS
description: Business Operations Platform — an operations control plane for a single-operator company.
colors:
  background: "oklch(0.99 0.01 150)"
  card: "oklch(1 0 0)"
  foreground: "oklch(0.18 0.02 160)"
  primary: "oklch(0.6 0.12 230)"
  primary-foreground: "oklch(0.98 0.01 230)"
  secondary: "oklch(0.95 0.02 160)"
  muted: "oklch(0.96 0.01 160)"
  muted-foreground: "oklch(0.45 0.02 160)"
  border: "oklch(0.92 0.01 160)"
  destructive: "oklch(0.55 0.2 25)"
  success: "oklch(0.545 0.13 160)"
  warning: "oklch(0.565 0.14 75)"
  status-operational: "oklch(0.58 0.13 160)"
  status-building: "oklch(0.66 0.13 75)"
  status-planned: "oklch(0.55 0.02 250)"
  status-attention: "oklch(0.55 0.2 25)"
typography:
  display:
    fontFamily: "Space Grotesk, Inter, ui-sans-serif, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.1em"
rounded:
  sm: "6px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: WWE OS

## 1. Overview

**Creative North Star: "The Control Room"**

WWE OS is an operations control plane, not consumer software or a marketing surface. The reference class is Linear, Stripe Dashboard, and GitHub Enterprise: calm, dense-but-breathable, engineered. Personality enters through typography and one deliberate signature — a monospace status language — never through decoration. The user must never feel they switched applications: one sidebar, one header, one theme, one command palette, one login, everywhere.

This system explicitly rejects generic AI-tool scaffolding: same-sized card grids as the default answer to every layout problem, flat interactions with no confirmation an action landed, gradient text, tracked-uppercase eyebrows above every section, and decorative 01/02/03 numbering. It also rejects anything that reads as a pitch — this is a working tool a single operator lives in all day, not a landing page.

**Key Characteristics:**

- Calm, dense-but-breathable information architecture
- One signature: the monospace status chip (dot + uppercase label), identical everywhere a module reports state
- Motion that confirms state changes, never decorates them
- Quiet elevation — depth from borders and background steps first, shadows only for genuine overlays
- Sentence case everywhere; no exclamation marks, no filler, no emoji

## 2. Colors

A cool, near-neutral canvas with one restrained brand accent; status and semantic colors are reserved vocabularies, never repurposed for decoration.

### Primary

- **Water Blue** (`oklch(0.6 0.12 230)`): primary actions and active states only. Never used for status, illustration, or emphasis outside an actionable element. The One Voice Rule — this is the only saturated color that "does" anything; its rarity is what makes it legible as an action signal.

### Neutral

- **Canvas** (`oklch(0.99 0.01 150)`): page background.
- **Surface** (`oklch(1 0 0)`): card and popover background, one step up from canvas.
- **Ink** (`oklch(0.18 0.02 160)`): primary text.
- **Muted ink** (`oklch(0.45 0.02 160)`): secondary text, timestamps, helper copy.
- **Line** (`oklch(0.92 0.01 160)`): borders, dividers, input strokes.

### Reserved vocabularies (never repurpose)

- **Status language** — `status-operational` (emerald), `status-building` (amber), `status-planned` (slate), `status-attention` (red): module lifecycle state only, always paired with a text label, never a color-alone signal.
- **Semantic** — `success` / `warning`: business data state (a KPI trending up, a bill confirmed) — a distinct vocabulary from module status, never mixed with it.

### Named Rules

**The Reserved Vocabulary Rule.** Status colors mean module lifecycle. Semantic colors mean business data outcome. Brand blue means "you can act on this." None of the three ever borrows another's job.

## 3. Typography

**Display Font:** Space Grotesk (with Inter, ui-sans-serif fallback)
**Body Font:** Inter (with ui-sans-serif, system-ui fallback)
**Label/Mono Font:** JetBrains Mono (with ui-monospace fallback)

**Character:** A geometric display face for the moments that need weight (page titles, registry numbers), a humanist body face for everything read at length, and a mono face reserved for machine-shaped facts — status, IDs, versions. The contrast between the three is the personality; none of them is decorative on its own.

### Hierarchy

- **Display** (600, `text-2xl`/`tracking-tight`): page titles only. Never body text, never labels.
- **Title** (500, `text-sm`): card and section titles.
- **Body** (400, `text-sm`): everything by default.
- **Supporting** (400, `text-xs`): secondary/helper text.
- **Label** (500, `text-[10px]–[11px]`, `tracking-[0.08em–0.12em]`, uppercase): status chips, section labels, kbd, IDs, code, versions. Never prose. Numbers in data contexts are always `tabular-nums`.

### Named Rules

**The Machine-Shaped Facts Rule.** Mono type appears only where the content genuinely is machine-shaped — an ID, a version, a status word, a keyboard shortcut. Never for prose, never for emphasis.

## 4. Elevation

Quiet by default. Depth comes from borders and background steps first; box-shadow escalates only for surfaces genuinely above the page — popovers, dialogs, dropdowns, and a card's own `hover:shadow-sm` when it links somewhere (the ceiling for resting content).

### Shadow Vocabulary

- **xs** (`0 1px 2px 0 oklch(0.19 0.015 250 / 0.05)`): the faintest possible separation; barely perceptible.
- **sm** (`0 1px 2px 0 oklch(0.19 0.015 250 / 0.06), 0 1px 3px 0 oklch(0.19 0.015 250 / 0.04)`): resting cards that are interactive (link somewhere) on hover.
- **md** (`0 2px 4px -1px oklch(0.19 0.015 250 / 0.06), 0 4px 8px -2px oklch(0.19 0.015 250 / 0.06)`): dropdowns, popovers.
- **lg** (`0 4px 8px -2px oklch(0.19 0.015 250 / 0.08), 0 12px 24px -4px oklch(0.19 0.015 250 / 0.1)`): dialogs, sheets — genuine overlays only.

### Named Rules

**The Quiet-By-Default Rule.** Nothing floats loudly in an ops tool. If a shadow is reaching for `lg` on resting page content, the content isn't actually elevated — use a border or background step instead.

## 5. Components

### Buttons

- **Shape:** `radius-md` (6px).
- **Primary:** `--primary` background, `--primary-foreground` text, one primary action per view.
- **Secondary / Ghost / Destructive:** secondary for the main card action, ghost for tertiary, destructive reserved for destruction only — never for emphasis.
- **Hover / Focus:** `transition-colors` (~150ms, `ease-out-quart`); focus ring always visible via `focus-visible:ring-*`, never `outline-none` without a replacement.

### Cards

- **Corner Style:** `radius-lg` (8px).
- **Background:** `--card`, one step lighter than `--background`.
- **Shadow Strategy:** resting flat; `hover:shadow-sm` only if the card itself is a link.
- **Padding:** `px-5 py-5`.
- **Not the default answer.** Reach for a card only when it's genuinely the best affordance for one self-contained unit — never as the generic wrapper for every piece of content on a page, and never nested.

### Inputs / Fields

- **Style:** `--input` border, `radius-md`, label always visible above the field.
- **Focus:** ring token, same visual language as every other focusable element.
- **Error:** `text-xs text-destructive` inline under the field — never a toast for validation.

### Navigation

- **Sidebar:** 264px fixed rail on desktop, same component as a mobile sheet — never two implementations. Active link gets `aria-current="page"` and an explicit focus ring.
- **Header:** 56px, sticky, backdrop blur.
- **Command palette:** Ctrl/⌘K, one implementation platform-wide.

### Status Chip (signature component)

A 1.5px square dot plus an uppercase, letterspaced mono label. Appears identically on module cards, page headers, and command-palette rows — state reads the same everywhere in the platform. Module cards take a 2px left rail in their status color on hover. This is the platform's face; nothing else carries this much repetition on purpose.

## 6. Do's and Don'ts

### Do:

- **Do** use the status chip (dot + mono uppercase label) as the only way module/record state is ever communicated.
- **Do** keep brand blue to actionable elements only — buttons, active nav, focus rings, links.
- **Do** let motion confirm a state change (a save, a status flip, a route change) — never add motion that isn't reporting something happened.
- **Do** use `transition-colors` (~150ms, `ease-out-quart`) as the default interactive feedback; Radix's built-in open/close motion for every overlay.
- **Do** write in sentence case, name things by what the user controls, and state errors plainly (what went wrong, how to fix it).

### Don't:

- **Don't** default to a card grid for every layout problem — same-sized cards with icon+heading+text repeated endlessly, or cards nested inside cards, is the AI-tool tell this system explicitly rejects.
- **Don't** ship an interaction with no feedback — every hover, click, and load state needs a visible response; a snap with nothing confirming it happened reads as broken, not fast.
- **Don't** use gradient text, tiny uppercase tracked eyebrows above every section, or decorative 01/02/03 numbering used as scaffolding rather than a real sequence.
- **Don't** use `border-left`/`border-right` greater than 1px as a colored accent stripe.
- **Don't** hardcode a color, radius, shadow, or layout dimension anywhere outside `packages/design-system/src/tokens.css`.
- **Don't** build a second sidebar, header, login, notification surface, or command palette anywhere in the platform — one of each, always.
- **Don't** use emoji or a direct `lucide-react` import — icons come from `@bop/icons` only.
