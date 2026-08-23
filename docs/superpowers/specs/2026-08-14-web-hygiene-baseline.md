# Web hygiene baseline: 404, robots, titles, alt text, privacy

**Status:** Implemented. **Scope:** Frontend only, `apps/web`.

## Context

A generic public-website SEO/lead-gen checklist (custom 404, sticky mobile
CTA, LocalBusiness schema, case studies, customer reviews, robots.txt, page
titles, alt text, privacy policy, etc.) was checked against this repo. Most
of it doesn't apply — WWE OS is a single-operator, login-gated internal ops
platform (`CLAUDE.md` "Product mode: single-operator"), not a public
marketing site trying to convert visitors. There is no lead funnel, no
public content to rank in search, and no case-study/review surface to build.

Five items were generic web hygiene independent of product type, and none of
them existed:

- No `not-found.tsx` anywhere — an unmatched route or a bad record id fell
  through to Next's default 404.
- No `robots.ts`/`robots.txt` — nothing told crawlers this app shouldn't be
  indexed.
- 14 of 32 `page.tsx` routes had no `metadata.title`, so the browser tab just
  read the root layout's bare "WWE OS" default with no way to tell pages
  apart (verified — the layout title template is `"%s · WWE OS"`, unused
  without a per-page title).
- Images: audited, already clean — the one raw `<img>` in the codebase
  (`(platform)/purchase/bill-details-dialog.tsx`) already has a real `alt`.
  Nothing to change here.
- No privacy notice, despite the public `/checkin` kiosk
  (`apps/web/src/app/checkin/`) capturing a face-recognition burst and
  device location from people before they've signed in.

## What changed

- `apps/web/src/app/not-found.tsx` — root 404 boundary (`EmptyState` +
  link back to the dashboard). Catches unmatched top-level routes and any
  `notFound()` call inside `(platform)` (bad ids on `/contracts/[id]`,
  `/dms/[id]`, `/inventory/[id]`, etc.), since that route group has no more
  specific `not-found.tsx` of its own to intercept first.
- `apps/web/src/app/robots.ts` — `disallow: "/"` for all user agents. Nothing
  in this app should be indexed.
- `metadata.title` (or `generateMetadata`) added to all 14 previously-bare
  routes, matching each page's existing `PageHeader` title. The four
  dynamic-record pages (`contracts/[id]`, `dms/[id]`, `inventory/[id]`,
  `hr/employees/[id]`) use `generateMetadata`, wrapping their existing
  `getX(id)` fetchers in React's `cache()` so `generateMetadata` and the page
  body share one request instead of fetching the record twice (their
  `djangoFetch` calls set `cache: "no-store"`, so without this each
  detail-page load would hit the API twice).
- `apps/web/src/app/checkin/page.tsx` was a `"use client"` component itself,
  which can't export `metadata`. Split into a thin server `page.tsx`
  (exports the title) and `checkin-client.tsx` (the moved client component,
  unchanged otherwise) — same split already used implicitly by every other
  route in the app.
- `apps/web/src/app/privacy/page.tsx` — new public, unauthenticated page
  (outside `(platform)`, same tier as `/login` and `/checkin`, since the
  kiosk collects biometric/location data pre-login). States what data the
  platform holds, that face-check-in frames and location are used only to
  verify and record attendance, and that the Owner is the only account with
  access (per the single-operator model — no external users). No invented
  legal/contact details; "contact the company administrator" instead of a
  fabricated email or address, since none exists in `config/company.ts`.
  Linked from Settings ("Legal" card) and from the `/checkin` kiosk footer.

## Explicitly not done (out of scope)

Case study section, 5 FAQs, sticky mobile CTA, response-time promise, real
customer reviews, LocalBusiness schema, map + directions, thank-you-after-
enquiry page, Google Analytics, real team photo, breadcrumbs, social share
images, meta descriptions per page. These assume a public marketing site
with visitors to convert and a physical storefront/service area — neither
applies to a login-gated internal ops tool. Revisit only if the product
grows a genuine public-facing marketing surface.
