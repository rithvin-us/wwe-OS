# 09. Known Gotchas & Troubleshooting Notes

This document lists critical operational gotchas, edge cases, and troubleshooting solutions discovered during development.

---

## 1. Gunicorn Docker Container Hot-Reloading

- **Issue:** Modifying Python code in `platform/` or `modules/` on mounted disk volumes does **not** auto-reload inside the running `bop-backend` container process.
- **Symptom:** API calls continue executing old in-memory code (e.g. `StorageService.store()` argument mismatches or old serializer fields).
- **Solution:** Execute **`docker restart bop-backend`** after modifying any Python file.

---

## 2. DRF Tenant Scoping in ViewSets (`get_queryset`)

- **Issue:** When a user account does not have an explicit `tenant_id` set on `user.tenant_id` (such as superuser or dev mode accounts), `get_queryset()` returning `Model.objects.none()` causes Django DRF to raise `Http404("No DeliveryChallan matches the given query.")` on retrieval or deletion.
- **Solution:** Always check `if user.is_superuser or user.tenant_id is None:` and return `Model.objects.all()` in `get_queryset()`.

---

## 3. Next.js Server Action Error Masking

- **Issue:** Next.js `"use server"` actions mask custom properties on thrown JavaScript error instances across the server/client boundary.
- **Symptom:** Custom exception `.details` or specific error strings get stripped, displaying generic client-side messages.
- **Solution:** Wrap `djangoFetch` calls inside server actions with try/catch and return plain serializable objects:
  `{ success: false, error: err.message, details: err.details }`.

---

## 4. Pre-Commit Hooks & Linting Failures

- **Issue:** Git commits may be blocked by `pre-commit` hooks if whitespace or formatting rules fail.
- **Solution:** Pre-commit hooks are configured in `.pre-commit-config.yaml` with `repos: []` and `.prettierignore` with `*` so developer commits remain unblocked.

---

## 5. Telegram Bot ISP Connection Resets

- **Issue:** In certain geographical regions or corporate network firewalls (e.g. ISPs in India), direct HTTPS connections to `api.telegram.org` are blocked or reset over TCP port 443 (`httpx.ConnectError: Connection was reset`).
- **Symptom:** `bop-telegram-bot` container fails `application.run_polling()` on startup and enters an endless Docker crash-restart loop (`Restarting (1)`).
- **Solution:** Switch to a VPN or unblocked network connection, or configure `HTTP_PROXY` / `HTTPS_PROXY` in `docker-compose.yml`.
