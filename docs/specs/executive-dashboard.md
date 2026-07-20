# Executive Dashboard

**Status: shell built, data not wired.** The landing page
(`apps/web/src/app/(platform)/page.tsx`) is a real, verified UI: KPI tiles,
financial/procurement/inventory/people/contracts summaries, recent activity,
pending approvals, operational alerts, AI insights, quick actions — all
rendering from a single typed data contract
(`apps/web/src/config/dashboard.ts`). Every panel currently shows an honest
empty state because no module feeds it real numbers yet. This spec is about
wiring, not designing — the design is done and is law
(`docs/design/design-bible.md`).

## 1. Functional requirements

- Answer "how is my company doing today?" in one screen — no drill-in
  required for the headline numbers.
- Every figure is either real or an honest "—" / empty state; never
  fabricated (already enforced as a hard rule, `CLAUDE.md`).
- Quick actions navigate to real create-flows, not stubs.

## 2. Non-functional requirements

- The dashboard must render fast even with zero data (already true — every
  panel has a real empty state, not a loading spinner masking "there's
  nothing here yet").
- Adding a new module's numbers to the dashboard must not require touching
  every other panel's code — each panel is independently sourced.

## 3. Database schema

None of its own — the dashboard is a read aggregator over other modules'
data (Purchase's bill statuses, HR's employee counts once integrated,
Finance once built, etc.). See § 4.

## 4. Entity relationships

```
DashboardPage → dashboard.ts contract → { KPIS, *_SUMMARY, PENDING_APPROVALS,
                OPERATIONAL_ALERTS, RECENT_ACTIVITY, AI_INSIGHTS, QUICK_ACTIONS }
                     ↑
        (today: static constants; target: each backed by a real query
         against the owning module's API, cached appropriately)
```

## 5. Folder structure (built)

```
apps/web/src/config/dashboard.ts          The data contract (typed, documented).
apps/web/src/components/dashboard/        greeting.tsx, kpi-tile.tsx,
                                           quick-actions.tsx, section-card.tsx
apps/web/src/app/(platform)/page.tsx      Composes the above.
```

## 6. Backend architecture (target)

A small aggregation endpoint, `GET /api/v1/dashboard/summary/`, is the
cleanest way to wire this without the frontend fanning out to every module's
API individually — the backend does the fan-out once, server-side, and
returns one shaped payload matching `dashboard.ts`'s types. This becomes real
once at least two modules (Purchase + one more) have real numbers worth
aggregating.

## 7. Frontend architecture (built)

Already correct for the target: `dashboard.ts` is the single place a backend
response would land — swapping the current static constants for a
`useQuery(['dashboard-summary'], fetchDashboardSummary)` call is the entire
frontend change required; no component changes needed.

## 8. API design (target)

```
GET /api/v1/dashboard/summary/   -- one call, shaped exactly like dashboard.ts
```

Rejected alternative: N calls (one per module) from the frontend — more
round trips, more loading-state complexity, no benefit at this scale.

## 9. Validation rules

N/A — read-only aggregation, no user input.

## 10. Business logic

None beyond aggregation. Each module owns the _meaning_ of its own numbers
(e.g. what counts as "low stock"); the dashboard only displays what modules
report, per the architecture's "modules provide meaning" rule.

## 11. Background jobs

If aggregation becomes expensive (many modules, complex queries), a
periodic pre-computation job (write a `dashboard_snapshot` row every N
minutes, serve that instead of computing live) is the natural next step —
not needed at current or near-term scale.

## 12. Event flow

Not event-driven — pull-based aggregation, refreshed on page load /
interval, not pushed on every underlying change. Simpler and sufficient for
a single-operator command center.

## 13. Queue design

N/A.

## 14–17. Error handling, security, testing, deployment

Follow `_shared-conventions.md`. Security note: the aggregation endpoint
must respect the caller's tenant scoping exactly like every other endpoint —
it is not a special "sees everything" bypass.

## 18. Mobile integration

This is the native app's home screen, nearly verbatim — same data contract,
mobile-native components instead of `@bop/ui`'s web components. Design once,
implement twice, same shape (see `docs/specs/mobile-application.md` § 3).

## 19. Dashboard integration

N/A — this document is the dashboard.

## 20. Future scalability

Per-widget refresh intervals (some panels change hourly, some daily) once
real usage patterns exist; not a concern with zero live data sources today.
