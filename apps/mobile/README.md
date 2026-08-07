# App · Mobile

Native client for WWE OS (Expo Router, React Native, SDK 57). Reuses
`@bop/sdk` for the API client, `@bop/shared-types` for backend contracts, and
`@bop/design-system` (`tokens.ts`) for the color palette — the same tokens
`apps/web` reads from `tokens.css`, hand-converted to sRGB hex since RN can't
parse OKLCH or CSS custom properties.

## Status

Foundation only, built end-to-end against the real backend (no mocks):

- Email/password auth against `platform/auth` (`/api/v1/auth/{login,refresh,me,logout}/`),
  tokens in `expo-secure-store` (native) / `localStorage` (web).
- `Stack.Protected` route guarding — signed out lands on `/login`, signed in on `/`.
- `/` is a placeholder ("Welcome back, {email}" + sign out) — the Executive
  Dashboard equivalent is the next build phase, not yet started.
- Google Workspace SSO is **not implemented** — it isn't implemented in
  `apps/web` either yet, so there's no backend endpoint to call.

## Run it

```bash
pnpm --filter mobile start
```

Copy `.env.example` to `.env` and point `EXPO_PUBLIC_API_URL` at the Django
server's **LAN address**, not `localhost` — a physical device (Expo Go, or a
dev build) can't resolve `localhost` to this machine. Run the backend bound
to all interfaces:

```bash
cd platform && python manage.py runserver 0.0.0.0:8000
```

Web preview (`pnpm --filter mobile web`) can use `localhost` fine, since it
runs in this machine's own browser.
