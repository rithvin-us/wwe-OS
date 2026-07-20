# Mobile Application

**Status: not built.** `apps/mobile/` does not exist yet. Confirmed direction
(`docs/roadmap/single-operator-plan.md`): a **separate native app** (Expo /
React Native), not a wrapped web view, and not a PWA.

## 1. Functional requirements

- Sign in with the same identity as the web app (JWT, same
  `/api/v1/auth/login/`; Google/Microsoft SSO once built on web extends here
  too).
- Home screen = the Executive Dashboard's mobile-native equivalent.
- Push notifications for anything currently in the in-app notification
  center (`platform/notifications`).
- Camera-based document capture feeding the same ingestion contract as
  Telegram (`docs/specs/document-ingestion.md`, `source_channel="upload"`).
- Review queue for reviewable items (confirm/reject purchase bills first).
- Offline-tolerant for the operations that matter on a phone: viewing recent
  data and queuing an upload/review action to sync when back online.

## 2. Non-functional requirements

- Mobile-first design for every new screen — not a cut-down version of the
  web layout, a purpose-built one using the same design tokens
  (`@bop/design-system`).
- Cold start fast enough to check "what needs my attention" in a few
  seconds — this app's job is quick, frequent glances, not long sessions.

## 3. Database schema

None on the client beyond a local cache/queue for offline actions
(pending uploads, pending review decisions) — source of truth is always the
platform API.

## 4. Entity relationships

Client-side: `PendingAction` (upload | review-decision) queued locally,
synced on connectivity, cleared on server acknowledgment. No new backend
schema — reuses every existing endpoint.

## 5. Folder structure (target)

```
apps/mobile/
  app/                 Expo Router screens (mirrors apps/web's route shape
                       where it makes sense: dashboard, purchase, settings)
  src/api/             Typed client reusing the same contracts as the web app
                       (candidate for a shared @bop/sdk package, see
                       packages/sdk — currently an empty placeholder)
  src/components/      Native components matching @bop/design-system tokens
  src/offline/         Local queue + sync logic
  src/notifications/   Push registration + handling
```

## 6. Backend architecture

No backend changes required beyond what other modules already need — the
mobile app is a new client of the existing `/api/v1/` surface, not a new API
shape. The one addition: device/push-token registration
(`POST /api/v1/notifications/devices/`, not yet designed) so
`platform/notifications` can add a push channel alongside in-app/email.

## 7. Frontend architecture

Expo + React Native, TypeScript throughout (shared conventions with
`apps/web`). Design tokens come from `@bop/design-system` — colors/type/
spacing are the same source of truth, translated to React Native's styling
model, never redefined. This is the same "one design system, every surface"
rule the design bible already states for web; mobile is not exempt.

## 8. API design

Reuses every existing endpoint. New: push device registration (see § 6),
and a lightweight `GET /api/v1/dashboard/summary/` consumer
(`docs/specs/executive-dashboard.md` § 8).

## 9. Validation rules

Client-side validation mirrors server-side (never trust the client, but
don't make the operator wait for a round trip to learn a required field is
empty).

## 10. Business logic

None on the client — all business rules live server-side, as everywhere
else in this platform. The client's only "logic" is the offline queue's
retry/sync behavior.

## 11. Background jobs

Background sync (Expo's background fetch / task APIs) to flush the offline
queue and refresh notification state periodically.

## 12. Event flow

Push notifications are the mobile-side consumer of the same
`Notification` records the web app's bell already shows — one event
pipeline, two delivery surfaces.

## 13. Queue design

Client-local queue only (§ 3) — no new server-side queue.

## 14. Error handling

Same error contract as web (`_shared-conventions.md`); the client must
handle "queued for retry" as a first-class UI state (not just success/error),
since offline is an expected condition here, not an edge case.

## 15. Security

Tokens stored in the platform's secure storage (Keychain/Keystore via Expo
SecureStore), never plain AsyncStorage. Biometric unlock as a convenience
layer over the same JWT session, not a replacement for it.

## 16. Testing strategy

Component tests (React Native Testing Library) + a contract test suite that
asserts the mobile client's API calls match the backend's actual OpenAPI
schema (`/api/v1/schema/`) — catches drift between mobile and backend early,
reusing the schema the backend already generates.

## 17. Deployment strategy

Expo EAS Build for App Store / Play Store submission; over-the-air updates
for JS-only changes via Expo Updates, full store review only for native
changes.

## 18. Mobile integration

N/A — this document is the mobile app.

## 19. Dashboard integration

The home screen, see § 1 and `docs/specs/executive-dashboard.md` § 18.

## 20. Future scalability

A shared `packages/sdk` (currently an empty placeholder in the monorepo)
should hold the typed API client both `apps/web` and `apps/mobile` consume —
build it when the mobile app starts, not before, so its shape is informed by
a real second consumer instead of guessed in advance.
