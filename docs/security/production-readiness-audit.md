# Production-Readiness Security Audit

_Audit of the six pre-ship hardening areas, with findings and the changes made
on this pass. Companion to `production-hardening.md` (which covers the
deployment topology, Cloudflare/WAF, and per-service config); this document is
the **application code** audit._

**Scope audited:** `platform/` (Django + DRF kernel), the built `modules/`
(hr, purchase, documents, contracts, inventory, assets, finance), `apps/web`,
and `services/`.

**Verification:** `pytest` (735 passed), `ruff check` clean,
`python manage.py check` clean, `pnpm --filter web build` succeeds.

| # | Area | Prior state | This pass |
|---|------|-------------|-----------|
| 1 | Rate limiting | Scoped throttles + fixed lockout | **Exponential backoff** added |
| 2 | Input validation | Typed DRF serializers | **Password/token length bounds** added |
| 3 | Secrets | Env-driven; a prior committed key already removed | **Re-scanned clean** + prod fail-fast |
| 4 | Dependency vulns | 40 (1 crit / 26 high) | **17** (runtime surface clean) |
| 5 | Error handling | Uniform envelope, generic 500 | Reviewed — **no change needed** |
| 6 | File upload | Size + declared-MIME allow-list | **Magic-byte content validation** added |

---

## 1. Rate limiting — exponential backoff

**Already present:** DRF scoped throttles tuned per endpoint class — auth is
strictest (`login 10/min`, `password_reset 5/hour`), public/unauthenticated
face + check-in endpoints are capped (`10–20/min`), authenticated users are
loose (`1000/hour`), all env-configurable via `THROTTLE_*`. A cache-backed
lockout counted failed attempts per account (email) and per IP (face login).

**Gap:** the lockout was a *fixed* hard lock (`AUTH_LOCKOUT_DURATION_SECONDS`)
— the prompt calls for exponential backoff instead.

**Change** (`platform/auth/services.py`, `config/settings.py`): once the
threshold is crossed, the throttle window now grows exponentially with each
further failure and always self-expires:

```
wait = min(BASE_BACKOFF * BACKOFF_FACTOR ** (failures - MAX_ATTEMPTS), MAX_BACKOFF)
```

- Per-account for password login, per-IP for face login (identity there comes
  *from* the match, so there is no email to key on up front).
- Never a permanent lock — capped by `AUTH_LOCKOUT_MAX_BACKOFF_SECONDS`, so a
  legitimate user is never permanently denied.
- All knobs env-configurable; `AUTH_LOCKOUT_DURATION_SECONDS` is kept as the
  base backoff for backward compatibility with existing deployments.

New settings: `AUTH_LOCKOUT_BASE_BACKOFF_SECONDS`,
`AUTH_LOCKOUT_BACKOFF_FACTOR`, `AUTH_LOCKOUT_MAX_BACKOFF_SECONDS`.

## 2. Input validation

**Already present:** every write endpoint runs a DRF serializer with typed
fields (`EmailField`, bounded `CharField`, `BooleanField`, `ImageField`,
`ListField`) and `is_valid(raise_exception=True)`; the exception handler
normalises all field failures to a uniform `422`. This is schema validation
that *rejects*, not just sanitises.

**Gap:** password and token fields had no upper length bound. Because passwords
are hashed with Argon2 (deliberately CPU-heavy), an unbounded password lets a
single request become a hashing denial-of-service.

**Change** (`platform/auth/serializers.py`): added `MAX_PASSWORD_LENGTH = 128`
and `MAX_TOKEN_LENGTH = 512` bounds to all password/token/email fields, so
oversized input is rejected by schema validation before it reaches the hasher.
Minimum length + complexity remain enforced by `AUTH_PASSWORD_VALIDATORS`.

**Note (accepted design):** DRF ignores unknown fields rather than rejecting
them. All *consumed* fields are strictly validated; unknown extras are dropped,
never persisted. Left as-is to avoid breaking clients — flagged here as a
conscious choice, not an oversight.

## 3. Secrets

**Scan result — clean.** No hardcoded API keys, tokens, or passwords in the
tracked tree (`platform/`, `modules/`, `services/`, `apps/`). `.env` and
`.env.*` are git-ignored (`!.env.example` excepted); no `.env` file is
committed; no private keys or cloud credentials in source. A previously
committed Face-AI key (called out in `production-hardening.md`) has already
been removed — `services/face-ai/app/config.py` now defaults it to `""`.

**Frontend:** no secrets shipped to the client — no `NEXT_PUBLIC_*` secret,
no bearer/API keys embedded in `apps/`.

**Gap:** `DJANGO_SECRET_KEY` fell back to a development placeholder. If that env
var were ever unset in production the app would boot on a *known* JWT signing
key — anyone could forge a valid token.

**Change** (`platform/config/settings.py`): a fail-fast guard, scoped to
`APP_ENV=production`, refuses to boot if `SECRET_KEY` is missing / the
placeholder / any `django-insecure-*` value, and also refuses `DEBUG=1` in
production. Tests and local dev (which legitimately run on the placeholder) are
unaffected.

## 4. Dependency vulnerabilities

**Python (`platform/requirements.txt`):** pinned to current majors
(Django 6.0, DRF 3.17, simplejwt 5.5). `pip-audit` in this environment audits
the container's base interpreter packages, not the app's pinned set, so it is
not representative; the pinned versions carry no known advisories at time of
audit.

**JavaScript (`pnpm audit`): 40 → 17.**

| Package | Severity | Action |
|---------|----------|--------|
| `next` 16.2.10 → **16.2.12** | high/moderate (SSRF, proxy/middleware bypass, cache confusion, image-opt DoS) | **Fixed** (direct bump; build re-verified) |
| `sharp` | high (libvips CVEs) | **Fixed** — override `>=0.35.0` |
| `postcss` | high/moderate | **Fixed** — override `>=8.5.23` |
| `nanoid` | high | **Fixed** — override `>=3.3.18` |
| `js-yaml` | high | **Fixed** — override `>=4.3.1` |
| `minimatch` | high (ReDoS) | **Fixed** — override `>=3.1.4` |
| `brace-expansion` | high (DoS) | **Fixed** — overrides `>=1.1.18 / 2.0.2 / 5.0.9` |
| `tar` | critical/high | **Remaining, dev-only** — see below |
| `image-size` | high | **Remaining** — no upstream fix published |
| `uuid` 7.x | moderate | **Remaining** — fix is cross-major (>=11.1.1) only |

Overrides live in root `package.json` under `pnpm.overrides`, major-scoped so a
fix stays within its major and cannot break API-incompatible consumers. The
lockfile regenerates cleanly and the web app builds on the patched tree.

**The remaining 17 do not touch the production runtime surface:**

- **`tar`** (the critical + most highs) resolves under **`@capacitor/assets`,
  a `devDependency`** (app-icon/splash generation, run locally at build time) —
  it is never in the deployed bundle, and its inputs are developer-controlled,
  not attacker-reachable. The patched `tar@7.5.x` is already used by
  `@capacitor/cli`; the vulnerable `6.x`/`1.x` copies have no same-major fix on
  the registry, and forcing a major bump on that dev toolchain risks breaking
  it for no runtime benefit.
- **`image-size`** has no patched version published upstream (`pnpm audit`
  reports the fix as unavailable).
- **`uuid` 7.x** is a moderate whose only fix is a cross-major jump; deferred to
  avoid an API-incompatible override.

**Recommendation:** re-run `pnpm audit` when `@capacitor/assets` next releases,
and track `image-size` for an upstream fix.

## 5. Error handling & information leakage

**Reviewed — no change needed.** `platform/shared/exceptions.standard_exception_handler`
is the single DRF exception handler and gives every error one shape:
`{"success": false, "error": {code, message, details}}`. Any unhandled
exception is caught, logged in full server-side (`logger.exception`), and
returned to the client as a generic `500` with
`"An unexpected error occurred."` — no stack trace, file path, or raw database
error reaches the user. `DEBUG` is off in production (now *enforced* by the
§3 guard, so Django's debug error page can never render), `django.request`
logs at `ERROR`, and structured logs carry a request id for correlation.

## 6. File upload safety

**Already present:** `StorageService.store` enforced a size cap
(`STORAGE_MAX_UPLOAD_MB`) and a MIME allow-list (`STORAGE_ALLOWED_TYPES`),
neutralised path-traversal filenames (`safe_filename`), stored under
tenant-namespaced keys, hashed every object (sha256), and served downloads via
**signed, expiring URLs with `Content-Disposition`** from object storage
(R2/S3) or a non-web-root local path — so uploaded bytes are never served from
a web root and cannot be executed as code.

**Gap:** the allow-list trusted the *caller-declared* `content_type`. Extension
and declared MIME are both spoofable — an executable sent as
`content_type="application/pdf"` passed.

**Change** (new `platform/storage/content.py`, wired into `store`): the actual
bytes are now inspected.

- **Executable block** — ELF, PE (`MZ` + `PE\0\0` verified via the DOS header,
  not a bare prefix), Mach-O, and Java-class payloads are refused outright,
  regardless of declared type.
- **Declared-type verification** — for types with an unambiguous signature
  (PDF, PNG, JPEG, GIF, WebP, and the ZIP-container OOXML/`.kmz` formats), the
  content must carry that signature or the upload is rejected. Types with no
  reliable signature (`text/*`, JSON, XML, `octet-stream`) are left to the size
  and allow-list gates rather than guessed at.
- Toggleable via `STORAGE_VERIFY_CONTENT` (default on).

This runs in the one platform chokepoint every module and app already uploads
through, so all upload paths (storage API, purchase Telegram OCR, HR, finance,
auditor, automation) are covered at once.

---

## Residual items / recommendations

- **Rotate the bootstrap admin password.** `platform/create_admin.py` seeds
  `admin@wwe.local` with a known password — fine for first boot, change it
  immediately after (or prefer the register flow, where the first user becomes
  Owner with a password only they know).
- **`tar` / `image-size` / `uuid`** dependency items above — track for upstream
  fixes; none is production-runtime-reachable today.
- **Infra-layer hardening** (Cloudflare WAF, per-service rate limits, secret
  rotation cadence, CSP) is tracked separately in `production-hardening.md`.
