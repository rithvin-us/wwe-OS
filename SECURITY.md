# Security

This document records a security review of WWE OS carried out on
**2026-07-24**, alongside a full pipeline debug/dead-code/documentation
pass. It lists what was found, what was fixed, what still needs action from
you, and what was reviewed and found acceptable. It is written to be read by
the operator, not just other engineers.

---

## 🔴 Action required from you

### 1. Rotate leaked credentials (highest priority)

`docker-compose.yml` hardcoded what appear to be **real, live credentials**
as fallback default values for the Telegram bot and Gemini API integration.
This file has been committed to git since the very first commit
(`095cfd4`, 2026-07-19) and the repository's `main` branch is currently
pushed to `github.com/rithvin-us/wwe-OS.git` — so these values have been in
version control, and potentially visible to anyone with repository access,
this entire time. The same values were also present in your local `.env`
file (gitignored, not itself a leak) and echoed as an example in
`docs/architecture/06-environment-and-dependencies.md` (now fixed to use a
placeholder).

**What was exposed:**

- `TELEGRAM_BOT_TOKEN` / `PLATFORM_SERVICE_TOKEN` (Telegram Bot API token
  format)
- `GEMINI_API_KEY`

**What you should do:**

1. Revoke and regenerate the Telegram bot token via **@BotFather** →
   `/revoke`.
2. Rotate the Gemini API key in Google AI Studio / Google Cloud Console.
3. Update your local `.env` with the new values (the old ones are now gone
   from `docker-compose.yml` and `.env.example`, both of which now require
   these variables to be set explicitly rather than falling back to a
   default).
4. **Old commits still contain the old values.** Removing them from the
   current file only stops the leak going forward — anyone who already
   cloned the repo, or who looks at git history, can still see the old
   token/key. If you want them fully scrubbed from history, that requires
   `git filter-repo` (or the BFG Repo-Cleaner) followed by a **force-push**
   to `origin/main`. This was deliberately **not done automatically** —
   it rewrites shared history and would break any other clone/fork without
   coordination. Ask if you'd like help with it once the credentials above
   are rotated (rotating first means the old history becomes harmless even
   if it's never scrubbed).

I did not test either credential against its provider's API — a found
secret was never used without your authorization.

### 2. Re-verify the Docker stack

`docker-compose.yml`'s secret-bearing variables (`DJANGO_SECRET_KEY`,
`TELEGRAM_BOT_TOKEN`, `PLATFORM_SERVICE_TOKEN`, `INGESTION_SERVICE_TOKENS`)
now use Compose's `${VAR:?message}` syntax — Compose will refuse to start
the `backend`/`telegram-bot` services with a clear error if they're missing
from your `.env`, instead of silently substituting a weak or leaked
default. Run `docker compose up -d --build` once after rotating your
credentials to confirm the stack still starts cleanly with your new values.

---

## ✅ Fixed this pass

### `SECRET_KEY` had a hardcoded insecure fallback

`platform/config/settings.py` previously read:

```python
SECRET_KEY = env_str("DJANGO_SECRET_KEY") or env_str("SECRET_KEY") or "insecure-dev-key-change-me"
```

If neither environment variable was set (or was set to an empty string),
Django — and by extension JWT signing (`SIMPLE_JWT["SIGNING_KEY"] =
SECRET_KEY`) — would silently run with a fixed, publicly-known string.
Anyone who knew that string could forge session data or JWTs. This is now:

```python
SECRET_KEY = env_str("DJANGO_SECRET_KEY") or env_str("SECRET_KEY", required=True)
```

It now fails loudly at startup instead of silently running insecurely. A
real random key was generated and placed in your local `.env` (gitignored)
so local dev keeps working.

### Local (non-Docker) runs never actually read `.env`

Tightening the `SECRET_KEY` check above immediately broke `python
manage.py check`/`runserver`/`pytest` run directly (not via Docker) —
investigation showed **no code anywhere loaded the repo-root `.env` file**
for these entrypoints (only Docker Compose's own env-file mechanism read
it). This means the documented local-dev commands had, until now, always
run on whatever was actually exported in your shell — silently falling
back to defaults (or the insecure key above) for anything not exported.
Fixed by adding `python-dotenv` and loading `.env` once, centrally, in
`platform/config/settings.py` (covers `manage.py`, `wsgi.py`, `asgi.py`,
and `pytest` uniformly). Real environment variables — as Docker and
production set them — always take precedence; `.env` is only a local-dev
fallback.

### Fixing the above exposed a real risk: tests could call a real AI provider

Loading `.env` for every entrypoint (including the test suite) meant
`pytest` would pick up your real `AI_DEFAULT_MODEL=gemini-flash-latest`
and `GEMINI_API_KEY` — so tests exercising the AI gateway started making
**real network calls to Google's Gemini API** instead of using the
deterministic `mock` provider the test suite is supposed to use. This was
caught immediately (tests failed with a real `429 quota exceeded` from
Gemini) and fixed by hard-pinning `AI_DEFAULT_MODEL="mock"` and clearing
`GEMINI_API_KEY`/`ANTHROPIC_API_KEY` in `platform/config/settings_test.py`,
the same way it already pins the email backend, cache, and database to
in-memory/local equivalents. Tests are now hermetic regardless of what a
developer's local `.env` contains — no quota burn, no external dependency,
no flakiness from a third party's rate limits.

### Empty, no-op pre-commit hooks

`.pre-commit-config.yaml` was `repos: []` — the documented command
(`python -m pre_commit run --all-files`, listed in `CLAUDE.md`) ran
successfully but checked nothing, which could give false confidence that
hooks were enforcing quality. Populated with local hooks that mirror CI
exactly (`ruff check`, `ruff format --check`, `prettier --check`,
`eslint`), and installed the git hook (`pre-commit install`) so it now
actually runs before every commit.

### Stray debug `print()` in the shared API exception handler

`platform/shared/exceptions.py` had a `print("DRF VALIDATION ERROR:",
exc.detail, flush=True)` inside `standard_exception_handler` — the
exception handler wired for the **entire API**
(`REST_FRAMEWORK["EXCEPTION_HANDLER"]`), so it fired on every plain DRF
validation error across every endpoint, writing exception detail straight
to stdout uncontrolled. Replaced with `logger.debug(...)` using the
file's existing (and previously unused, for this line) logger, so output
now goes through normal log level/formatting/routing instead of always
printing.

---

## Reviewed and found sound (no change needed)

These were checked specifically because they're common sources of
vulnerabilities — listed here so you know they were actually looked at,
not just assumed fine.

- **Password storage:** Argon2 as the primary hasher (PBKDF2/BCrypt as
  fallback), a configurable minimum length (10 by default), and a custom
  complexity validator on top of Django's standard validators.
- **Brute-force protection:** login lockout after N failed attempts
  (`AUTH_LOCKOUT_MAX_ATTEMPTS`, default 5), cache-backed, time-boxed —
  implemented correctly in `platform/auth/services.py`.
- **Password reset / email verification tokens:** generated with
  `secrets.token_urlsafe(32)` (cryptographically random), stored only as a
  SHA-256 hash (never in plaintext), single-use, expiring. The reset
  endpoint doesn't reveal whether an email is registered (no user
  enumeration).
- **JWT handling:** short-lived access tokens (15 min default), refresh
  rotation with blacklist-after-rotation enabled, so a stolen refresh token
  can't be replayed indefinitely.
- **Service-to-service auth:** the shared-secret comparison in
  `platform/shared/service_auth.py` uses `hmac.compare_digest` —
  constant-time, not vulnerable to a timing attack.
- **CORS/CSRF:** `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` are
  explicit allowlists (not wildcard), `CORS_ALLOW_CREDENTIALS` is scoped to
  that allowlist. Session/CSRF cookies are `httpOnly` + `SameSite=Lax`
  always, and gain `Secure` + HSTS automatically once `DEBUG=False`.
- **Frontend token handling:** the Next.js login/refresh routes hold JWTs
  as `httpOnly` cookies — never returned to client-side JavaScript, so
  they're unreachable even in the event of an XSS bug elsewhere. Cookies
  are marked `secure` in production.
- **No `dangerouslySetInnerHTML`** anywhere in `apps/web/src` — no obvious
  stored/DOM XSS vector via unescaped HTML injection.
- **No raw SQL** (`.raw()`, `.extra()`, manual `cursor.execute`) anywhere
  in `platform/` or `modules/` — every query goes through the Django ORM,
  which parameterizes by default.
- **File downloads always force `Content-Disposition: attachment`**
  (`platform/storage/views.py`, both the authenticated and the
  signed-URL/anonymous download paths) — even if a malicious file's
  declared content-type were spoofed as something a browser would render
  inline (e.g. HTML), the browser is instructed to download it, not
  execute it.
- **Signed download URLs** use Django's own cryptographic signing
  (`django.core.signing`) with a salt and an expiry check — unguessable,
  time-boxed, scoped to one object key.

---

## Known, accepted residual risks (not changed — documented instead)

### Tenant-scoping fallback when `tenant_id` is `None`

A recurring pattern across 8 files (`ai`, `audit`, `automation` ×2,
`users`, `tagging`, `reporting`, `storage`) looks like:

```python
if not user.is_superuser and user.tenant_id is not None:
    qs = qs.filter(tenant_id=user.tenant_id)
```

If a non-superuser user somehow has `tenant_id = None`, the tenant filter
is **skipped entirely** and the query returns rows across *all* tenants.
This is a deliberate, already-documented design choice (to avoid spurious
404s for edge-case users) rather than an oversight, and it's low-risk under
the platform's current single-tenant, single-operator deployment model.
It was **not changed** in this pass because it's a wide-blast-radius,
cross-cutting behavior change that several passing tests already rely on —
but it's worth a deliberate look **before** the dormant multi-tenant
backend is ever reactivated for a real second tenant, since a bug anywhere
that leaves `tenant_id` unset on a real non-superuser user would leak data
across tenants.

### Upload content-type allowlist trusts the client's declared MIME type

`platform/storage/services.py` checks the uploaded file's `content_type`
against `STORAGE_ALLOWED_TYPES` — but that value comes from the client's
request, not from inspecting the actual file bytes (no magic-byte
sniffing). A malicious upload could declare a false content type to bypass
the allowlist. The practical impact is limited because every download path
forces `Content-Disposition: attachment` (see above), so even a
successfully-smuggled file can't execute or render inline in a browser —
but real content-sniffing (e.g. via `python-magic`) would be a reasonable
future hardening step if file uploads become a larger attack surface.

---

## Scope of this review

Covered: Django settings (secrets, CORS/CSRF, cookies, headers, JWT),
authentication and password-reset flows, service-to-service auth, file
upload/download handling, frontend token storage and cookie flags, common
injection vectors (SQL, XSS), dependency-declared secrets in
`docker-compose.yml` and `.env.example`, and the pre-commit/CI pipeline
configuration itself.

Not covered (out of scope for this pass, flagged for awareness): a
dependency-vulnerability scan of `requirements.txt`/`package.json` against
a CVE database, load/performance testing, and a live penetration test
against a running deployment. See `docs/specs/testing-strategy.md` §§ 15–16
for the existing plan around that kind of testing.
