# Product

## Register

product

## Users

A single operator running an entire company — HR, IT, and Accounts simultaneously — plus, as the company grows, the HR/accounts/purchase/warehouse managers who eventually join. They live in this tool for real operational decisions (approvals, purchase review, document management, contracts, reporting), not casual browsing. Context: desk-based, business hours, needs fast, confident actions — not exploration or discovery.

## Product Purpose

WWE OS is a Business Operations Platform — one command center that runs a company's operations (purchasing, HR, documents, inventory, contracts, reporting) on a single shared kernel, replacing fragmented tools (spreadsheets, email, Slack, paper). Success looks like: the operator trusts every number on screen, completes tasks faster than the tools it replaces, and the product never feels like developer software — it feels like precise, authoritative business tooling built by people who understand real operations.

## Brand Personality

Precise & authoritative — a Linear/Stripe-dashboard register. Quiet confidence: minimal chrome, purposeful motion that confirms actions happened rather than decorating the page. No hand-holding, no gimmicks — the product respects the operator's time and expertise.

## Anti-references

- Generic AI-generated SaaS card grids — same-sized cards with icon+heading+text repeated everywhere, nested cards used as the default answer for everything.
- Flat, lifeless interactions — no feedback on hover/click/load; state changes that just snap with no confirmation the action landed.
- Gradient text, tiny uppercase tracked eyebrows/kickers, decorative 01/02/03 numbered section markers used as scaffolding rather than a real sequence.
- Anything that reads as a marketing/landing-page treatment — this is a working tool, not a pitch.

## Design Principles

1. **Motion confirms, never decorates.** Every animation exists to tell the operator their action landed, or to orient them through a transition. Nothing moves "for delight" alone.
2. **Precision over prettiness.** Favor exact alignment, real data density, and restraint over generic ornamentation.
3. **One system, everywhere.** The sidebar, header, command palette, and dialogs are singular. A redesign changes the system once, not per screen.
4. **Never developer-facing.** End users see business content in plain language — never module health, dev/repo/deployment status, or session/account internals.
5. **Honest data.** No fake numbers, no invented figures. Empty, loading, and error states are first-class, not afterthoughts.

## Accessibility & Inclusion

WCAG AA minimum, matching the existing `docs/design/design-bible.md` contrast requirements. Reduced motion is non-negotiable — every animation must collapse to instant/crossfade under `prefers-reduced-motion: reduce` (already enforced globally in `apps/web/src/app/globals.css`); new motion work must respect that contract, not bypass it.
