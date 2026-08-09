# WWE OS — Production Security Hardening Plan

Practical, step-by-step hardening for the WWE OS production topology. Every
section is a checklist with exact configuration and copy-pasteable code. No
theory.

## Topology (what we are securing)

```
                            Cloudflare (orange cloud, WAF, rate limit, Access)
                                          │
     ┌───────────────┬───────────────────┼───────────────────┬──────────────────┐
     │               │                   │                    │                  │
app.water-works.in  api.water-works.in  bot.water-works.in   ai.water-works.in
  (Vercel)           (Render/Django)     (Cloudflare Tunnel   (Cloudflare Tunnel
  frontend           /api/v1/            → local PTB webhook)  → local FastAPI face-ai)
```

- Frontend: Vercel (`apps/web`)
- Backend: Render, Django + DRF (`platform/`, exposes `/api/v1/`)
- Telegram bot: `services/telegram-bot/main.py` (python-telegram-bot `run_webhook`)
- AI/face backend: `services/face-ai/app/main.py` (FastAPI)
- Local services reach the internet only through Cloudflare Tunnel (no public IP, no port-forward).

## 0. FIX FIRST — committed secrets & wildcards (do these today)

These are real issues in the current tree. Nothing else matters until they are done.

- [ ] **Rotate & un-hardcode the Face-AI key.** `services/face-ai/app/config.py:25`
      ships a real key (`a4e844c5-…（redacted, rotate it）`). Treat it as
      compromised. Generate a new one, set it via env only, and remove the default:
  ```python
  # services/face-ai/app/config.py
  # BEFORE: FACE_AI_API_KEY: str = "a4e844c5-...."   # committed secret
  FACE_AI_API_KEY: str = ""   # MUST be provided via env in every deployed environment
  ```
  Generate a new value and store it in the face-ai `.env` and in Render as
  `FACE_AI_API_KEY` (same value on both sides):
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```
- [ ] **Fail closed when the key is empty in production.** Right now
      `_require_api_key` returns early if the key is unset (`main.py:98`), i.e.
      no auth. Add a startup guard (see §3).
- [ ] **Un-hardcode the Telegram webhook secret.** `services/telegram-bot/main.py:555`
      falls back to `"wwe-telegram-secret"`. Require it explicitly:
  ```python
  secret_token = os.environ["WEBHOOK_SECRET"]  # no fallback; crash if missing
  ```
- [ ] **Replace Face-AI wildcard CORS** (`services/face-ai/app/main.py:74`,
      `allow_origins=["*"]`) — the AI service is called server-to-server from
      Django, never from a browser. See §3.
- [ ] Confirm `DJANGO_SECRET_KEY` is set on Render (it is `generateValue: true`
      in `render.yaml`, good) and that the dev placeholder in `settings.py:45`
      is never used in prod. Add the check in §4.
- [ ] `git grep` for any other secrets before pushing:
  ```bash
  git grep -nE "(api[_-]?key|secret|token|password)\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}" -- services platform apps
  ```

---

## 1. CLOUDFLARE SECURITY

All of this is at the zone `water-works.in`. Do it in the dashboard (paths given)
or via API/Terraform later.

### 1.1 Baseline zone settings

- [ ] SSL/TLS → Overview → **Full (strict)**. (Never "Flexible".)
- [ ] SSL/TLS → Edge Certificates → **Always Use HTTPS = On**, **Min TLS 1.2**,
      **TLS 1.3 = On**, **Automatic HTTPS Rewrites = On**.
- [ ] SSL/TLS → Edge Certificates → **HSTS**: enable, max-age 12 months,
      include subdomains, preload (only once every subdomain is HTTPS — it is).
- [ ] Network → **gRPC/WebSockets** off unless needed; **Onion Routing** off.
- [ ] Every hostname (`app`, `api`, `bot`, `ai`) is **proxied (orange cloud)**.
      A grey-cloud record leaks the origin IP and bypasses every rule below.
- [ ] Scrape Shield → **Email Address Obfuscation On**, **Hotlink Protection On**.

### 1.2 WAF — Managed Rules

- [ ] Security → WAF → **Managed Rules**: deploy **Cloudflare Managed Ruleset**
      and **Cloudflare OWASP Core Ruleset**. Set OWASP **Paranoia Level 2**,
      action **Managed Challenge** for anomaly score ≥ 40, **Block** ≥ 60.
- [ ] Leave Managed Rules on for `api`, `app`, `ai`; for `bot` you will instead
      lock the path down hard in 1.4 (OWASP can false-positive on Telegram JSON).

### 1.3 WAF — Custom Rules (exact expressions)

Security → WAF → **Custom rules**. Order matters (top = evaluated first).

**Rule 1 — Lock the bot endpoint to Telegram only (Block).**
Telegram does not publish a formal IP allowlist for outbound webhooks, so rely
on the secret header (validated at the origin, §2) and shape the edge:

```
(http.host eq "bot.water-works.in" and http.request.method ne "POST")
or
(http.host eq "bot.water-works.in" and not starts_with(http.request.uri.path, "/telegram"))
```

Action: **Block**. This drops everything that is not `POST /telegram`.
Optionally also require the header shape exists:

```
http.host eq "bot.water-works.in" and not any(http.request.headers.names[*] eq "x-telegram-bot-api-secret-token")
```

Action: **Block**. (Header names are lowercased by Cloudflare.)

**Rule 2 — AI endpoint: only server-to-server, block browsers/tools (Managed Challenge/Block).**
The AI service is only ever called by Render (Django). Block anything that looks
like a browser or is missing the API key header:

```
http.host eq "ai.water-works.in" and (
  not any(http.request.headers.names[*] eq "x-api-key")
  or http.request.method ne "POST"
  and not starts_with(http.request.uri.path, "/health")
)
```

Action: **Block**. (Allow `GET /health` for probes.) The real auth is the
`X-API-Key` check in FastAPI (§3) + Cloudflare Access (§7) — this rule just
sheds noise at the edge.

**Rule 3 — Block admin/doc surfaces from the public (Block).**
Your OpenAPI docs (`/api/v1/docs/`, `/redoc/`, `/schema/`) and `/metrics` should
not be world-readable:

```
http.host eq "api.water-works.in" and (
  starts_with(http.request.uri.path, "/api/v1/docs")
  or starts_with(http.request.uri.path, "/api/v1/redoc")
  or starts_with(http.request.uri.path, "/api/v1/schema")
  or http.request.uri.path eq "/metrics"
)
```

Action: **Managed Challenge** (or Block, or put behind Access §7).

**Rule 4 — Method allowlist for the API (Block).**

```
http.host eq "api.water-works.in" and not (
  http.request.method in {"GET" "POST" "PUT" "PATCH" "DELETE" "OPTIONS"}
)
```

Action: **Block**.

**Rule 5 — Drop obvious junk / known-bad paths (Block).**

```
(http.request.uri.path contains "/wp-admin")
or (http.request.uri.path contains "/.env")
or (http.request.uri.path contains "/.git")
or (http.request.uri.path contains "phpmyadmin")
or (lower(http.request.uri.query) contains "union select")
or (lower(http.request.uri.query) contains "<script")
```

Action: **Block**.

### 1.4 Bot protection

- [ ] Security → Bots → **Bot Fight Mode = On** (free) or **Super Bot Fight Mode**
      (Pro+): set **Definitely automated = Block**, **Likely automated = Managed
      Challenge**, **Verified bots = Allow**.
- [ ] Exempt `bot.water-works.in` from bot challenges (Telegram is an automated
      client) via a WAF skip rule:
  ```
  http.host eq "bot.water-works.in"
  ```
  Action: **Skip** → Super Bot Fight Mode (still keep Rule 1 above).

### 1.5 Firewall / IP & country rules (optional)

- [ ] Security → WAF → Custom rules. If your operator is India-only, challenge
      the rest of the world on the human-facing app:
  ```
  http.host eq "app.water-works.in" and ip.geoip.country ne "IN"
  ```
  Action: **Managed Challenge** (don't hard-block — you may travel).
- [ ] Never geo-block `api` or `bot` (Telegram/Render egress is not in India).
- [ ] Keep an explicit allow for your own office/home IP:
  ```
  ip.src in {203.0.113.10 203.0.113.11}
  ```
  Action: **Skip** all remaining custom rules (put at the very top).

### 1.6 Rate limiting (see §8 for the full table)

Security → WAF → **Rate limiting rules**. Cloudflare-level limits are the outer
ring; DRF/FastAPI limits (§3,§4,§8) are the inner ring. Configure both.

---

## 2. TELEGRAM BOT SECURITY

Your bot uses `python-telegram-bot`'s `run_webhook(..., secret_token=...)`.
PTB **automatically** validates the `X-Telegram-Bot-Api-Secret-Token` header on
every incoming update and rejects mismatches with 403 — so spoofed requests that
don't carry your secret never reach a handler. You must (a) set a strong secret,
(b) register it with Telegram, (c) not leak it.

### 2.1 Checklist

- [ ] Generate a strong webhook secret (1–256 chars, `A-Z a-z 0-9 _ -`):
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```
  Store as `WEBHOOK_SECRET` (bot env) — no hardcoded fallback (§0).
- [ ] Register the webhook with the **same** secret so Telegram sends the header:
  ```bash
  curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    --data-urlencode "url=https://bot.water-works.in/telegram" \
    --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
    --data-urlencode "allowed_updates=[\"message\"]" \
    --data-urlencode "drop_pending_updates=true" \
    --data-urlencode "max_connections=20"
  ```
- [ ] Verify:
  ```bash
  curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
  # expect: "url": ".../telegram", "has_custom_certificate": false, pending_update_count low
  ```
- [ ] Keep the Cloudflare Rule 1 (§1.3) so non-`POST /telegram` is dropped at the edge.
- [ ] Restrict who the bot serves. The bot currently trusts any Telegram user.
      Gate on an allowlist of chat IDs (the single operator + anyone they approve):
  ```python
  # top of services/telegram-bot/main.py
  ALLOWED_TELEGRAM_IDS = {
      int(x) for x in os.getenv("ALLOWED_TELEGRAM_IDS", "").replace(" ", "").split(",") if x
  }

  def _authorized(update: Update) -> bool:
      if not ALLOWED_TELEGRAM_IDS:
          return True  # open (dev) — set the env var in prod
      user = update.effective_user
      return bool(user and user.id in ALLOWED_TELEGRAM_IDS)
  ```
  Then at the top of each handler:
  ```python
  async def handle_document(update, context):
      if not _authorized(update):
          await update.message.reply_text("⛔ Not authorized.")
          return
      ...
  ```
- [ ] Never log the bot token or secret. Confirm `logging` never prints
      `os.getenv("TELEGRAM_BOT_TOKEN")` (it is interpolated into a file URL at
      `main.py:389` — keep that out of any log line).

### 2.2 If you migrate the bot to FastAPI

You asked for a FastAPI example. If you replace PTB's built-in webhook server
with FastAPI, you must validate the header yourself (PTB does it for you today):

```python
# webhook_fastapi.py
import hmac, os
from fastapi import FastAPI, Header, HTTPException, Request

app = FastAPI()
WEBHOOK_SECRET = os.environ["WEBHOOK_SECRET"]  # no fallback

@app.post("/telegram")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    # 1. Constant-time secret check — rejects spoofed calls.
    if not x_telegram_bot_api_secret_token or not hmac.compare_digest(
        x_telegram_bot_api_secret_token, WEBHOOK_SECRET
    ):
        raise HTTPException(status_code=403, detail="forbidden")

    # 2. Parse + hand off to your update logic.
    update = await request.json()
    # ... enqueue / process update ...
    return {"ok": True}

@app.get("/health")
def health():
    return {"status": "ok"}
```

Optional defense-in-depth: also verify the source IP is in Telegram's published
webhook ranges `149.154.160.0/20` and `91.108.4.0/22` (read the real client IP
from `CF-Connecting-IP`, since Cloudflare fronts you):

```python
import ipaddress
TELEGRAM_NETS = [ipaddress.ip_network("149.154.160.0/20"),
                 ipaddress.ip_network("91.108.4.0/22")]

def _from_telegram(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in net for net in TELEGRAM_NETS)
# in the handler: client_ip = request.headers.get("cf-connecting-ip", request.client.host)
```

Treat the secret token as primary; IP ranges can change, so log-and-alert on
mismatch rather than hard-blocking if you're unsure.

---

## 3. AI BACKEND SECURITY (face-ai FastAPI, `ai.water-works.in`)

The service already does a **constant-time `X-API-Key` check** (`main.py:96-104`)
— good. Harden the rest.

### 3.1 Checklist

- [ ] **Fail closed.** Require the key in prod instead of silently disabling auth
      when unset:
  ```python
  # services/face-ai/app/main.py  (replace _require_api_key)
  def _require_api_key(x_api_key: str | None = Header(default=None)) -> None:
      expected = settings.FACE_AI_API_KEY
      if not expected:
          # No key configured — refuse to serve rather than run open.
          raise HTTPException(status_code=503, detail="Service auth not configured")
      if not x_api_key or not hmac.compare_digest(x_api_key, expected):
          raise HTTPException(status_code=401, detail="Invalid or missing API key")
  ```
  (Keep an env like `FACE_AI_ALLOW_OPEN=1` only for local dev if you want the old
  behavior — never set it in prod.)
- [ ] **Lock CORS.** The service is called server-to-server from Django, not from
      a browser. Replace the wildcard:
  ```python
  # services/face-ai/app/main.py
  app.add_middleware(
      CORSMiddleware,
      allow_origins=[o for o in os.getenv("FACE_AI_CORS_ORIGINS", "").split(",") if o],
      allow_methods=["POST", "GET"],
      allow_headers=["X-API-Key", "Content-Type"],
      allow_credentials=False,
  )
  ```
  Leave `FACE_AI_CORS_ORIGINS` empty in prod (no browser origin needs it). Only
  the Django backend (server-side, CORS-exempt) calls it.
- [ ] **Restrict to your app's traffic path.** The browser at `app.water-works.in`
      must **never** call `ai.water-works.in` directly — it goes
      browser → Django (`api`) → face-ai (`ai`). Keep it that way:
      the face embedding/gallery match logic already runs in the backend; the browser
      only ever talks to `api.water-works.in`. Enforce via Cloudflare Access (§7) so
      only the Render service token can reach `ai`.
- [ ] **Request validation & limits.** Cap upload size and frame count (frames are
      already capped to 4 at `main.py:168`). Add a body-size guard:
  ```python
  MAX_UPLOAD_BYTES = int(os.getenv("FACE_AI_MAX_UPLOAD_BYTES", 8 * 1024 * 1024))

  async def _read_capped(file: UploadFile) -> bytes:
      data = await file.read()
      if len(data) > MAX_UPLOAD_BYTES:
          raise HTTPException(status_code=413, detail="Image too large")
      if not data:
          raise HTTPException(status_code=400, detail="Empty image upload")
      return data
  ```
  Also validate content type against `{"image/jpeg","image/png","image/webp"}`.
- [ ] **Rate limit.** Add `slowapi` (Redis or in-memory) in front of the two
      heavy endpoints:
  ```python
  # pip install slowapi
  from slowapi import Limiter, _rate_limit_exceeded_handler
  from slowapi.util import get_remote_address
  from slowapi.errors import RateLimitExceeded

  limiter = Limiter(key_func=lambda r: r.headers.get("cf-connecting-ip") or get_remote_address(r))
  app.state.limiter = limiter
  app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

  @app.post("/verify-face", ...)
  @limiter.limit("30/minute")
  async def verify_face(request: Request, ...): ...

  @app.post("/enroll-face", ...)
  @limiter.limit("10/minute")
  async def enroll_face(request: Request, ...): ...
  ```
- [ ] **Never expose model internals in errors.** `FaceError` messages are fine
      (they're intentional), but don't leak stack traces — FastAPI hides them by
      default; keep `debug=False`.

---

## 4. DJANGO BACKEND SECURITY (Render, `api.water-works.in`)

Good news: `platform/config/settings.py` is already production-shaped —
stateless JWT (no session/admin surface), Argon2 hashing, rotation + blacklist,
throttle scopes, HSTS/SSL-redirect when `DEBUG=False`, `corsheaders`,
`CSRF_TRUSTED_ORIGINS`. Tighten the deltas.

### 4.1 CORS — only `app.water-works.in`

`render.yaml` currently sets `CORS_ALLOWED_ORIGINS=https://wwe-os.vercel.app`.
Change it to your real frontend origin(s):

```yaml
# render.yaml  (backend service envVars)
- key: CORS_ALLOWED_ORIGINS
  value: https://app.water-works.in
- key: CSRF_TRUSTED_ORIGINS
  value: https://app.water-works.in
- key: DJANGO_ALLOWED_HOSTS
  value: api.water-works.in
```

- [ ] Never use `CORS_ALLOW_ALL_ORIGINS`. `CORS_ALLOW_CREDENTIALS = True` is
      already set (`settings.py:347`) — that requires an explicit origin list, so
      wildcard would be a bug anyway.
- [ ] Keep `DJANGO_ALLOWED_HOSTS` to the exact host. The `.onrender.com` default
      in `render.yaml:24` is fine for the health check but add your real host.

### 4.2 Startup guard — refuse to boot insecure in prod

Add to the bottom of `settings.py`:

```python
# --- Production safety net -------------------------------------------------
if APP_ENV == "production":
    _insecure = SECRET_KEY.startswith("django-insecure-")
    if DEBUG or _insecure:
        raise RuntimeError("Refusing to start: DEBUG on or default SECRET_KEY in production.")
    if not INGESTION_SERVICE_TOKENS:
        raise RuntimeError("INGESTION_SERVICE_TOKENS must be set in production.")
```

### 4.3 Auth strategy

- [ ] Keep **JWT** (`Authorization: Bearer <access>`) for the human app; access
      token 15 min, refresh 7 d, rotation + blacklist are already on
      (`SIMPLE_JWT`, `settings.py:260`). Good.
- [ ] Keep **service tokens** (`Authorization: Service <token>`) for the bot /
      email / OCR ingestion only, via `ServiceTokenAuthentication`
      (`shared/service_auth.py`). It already carries a non-DB `ServiceActor` with
      zero platform permissions — never widen that.
- [ ] Store refresh tokens in an **HttpOnly, Secure, SameSite=Lax** cookie on the
      frontend if you're not already; never in `localStorage`.

### 4.4 Protect "admin" and docs

- There is **no Django admin** installed (no `django.contrib.admin`, no session
  middleware) — one less attack surface. Keep it that way; don't add it.
- [ ] Gate OpenAPI docs/schema. Either block at the edge (§1.3 Rule 3) or disable
      in prod:
  ```python
  # only mount docs/redoc/schema when DEBUG or an env flag is set
  if DEBUG or env_bool("ENABLE_API_DOCS", default=False):
      urlpatterns += [ ...docs... ]
  ```
- [ ] `/metrics` is already token-gated (returns 404 until `METRICS_TOKEN` set,
      `settings.py:459`). Set `METRICS_TOKEN` in prod and pass it from your
      scraper only.

### 4.5 Common attacks

- [ ] **SQL injection** — you use the Django ORM; never build raw SQL from user
      input. If you must, use parameterized `cursor.execute(sql, params)`.
- [ ] **XSS** — API is JSON-only (`StandardJSONRenderer`), and the Next.js
      frontend escapes by default; never `dangerouslySetInnerHTML` with server
      data. Add CSP at the edge (§6).
- [ ] **CSRF** — the JSON API is JWT-in-header (not cookie), so CSRF doesn't
      apply to it; `CsrfViewMiddleware` + `CSRF_TRUSTED_ORIGINS` cover any
      cookie/session form paths. Keep `CSRF_COOKIE_SECURE/HTTPONLY` (already set).
- [ ] **Mass assignment / over-posting** — DRF serializers with explicit `fields`
      (not `"__all__"`) on write paths. Audit serializers for `fields = "__all__"`.
- [ ] **File uploads** — `STORAGE_MAX_UPLOAD_MB` (25) and `STORAGE_ALLOWED_TYPES`
      are enforced; keep the allowlist tight. Validate magic bytes, not just the
      declared content-type, for the bill/selfie ingestion paths.
- [ ] Keep dependencies patched: enable Dependabot / `pip-audit` + `pnpm audit` in CI.

### 4.6 Ingestion & public endpoints throttling

`DEFAULT_THROTTLE_RATES` already defines `login`, `password_reset`, `ingestion`,
`hr_checkin`, `user`, `anon`. Confirm each sensitive view sets its scope:

- login/refresh → `throttle_scope = "login"`
- password reset → `"password_reset"`
- bill ingest (`/api/v1/purchase/bills/ingest/`) → `"ingestion"`
- public face check-in (HR) → `"hr_checkin"` (already 20/min)

---

## 5. CLOUDFLARE TUNNEL HARDENING

Your local `bot` and `ai` boxes are exposed only via `cloudflared`. Lock the
tunnel so nothing bypasses Cloudflare.

### 5.1 Checklist

- [ ] **Bind the local service to loopback only.** face-ai/PTB should listen on
      `127.0.0.1`, so the only way in is the tunnel. face-ai's uvicorn:
  ```bash
  uvicorn app.main:app --host 127.0.0.1 --port 9000
  ```
  (The Telegram PTB server listens on `0.0.0.0` at `main.py:559`; if that box has
  no inbound firewall exception it's still unreachable, but prefer `127.0.0.1`
  and let the tunnel connect locally. Set `listen="127.0.0.1"` if you keep PTB.)
- [ ] **Tighten ingress in `~/.cloudflared/config.yml`.** Restrict to the exact
      hostname + path and 404 everything else (the example already has the
      catch-all):
  ```yaml
  tunnel: <tunnel-id>
  credentials-file: /path/<tunnel-id>.json
  originRequest:
    connectTimeout: 10s
    noTLSVerify: true # local hop is plain HTTP; edge is still HTTPS
    httpHostHeader: ai.water-works.in
  ingress:
    - hostname: ai.water-works.in
      path: ^/(health|version|enroll-face|verify-face)$
      service: http://127.0.0.1:9000
    - service: http_status:404 # required catch-all — everything else dies here
  ```
  Same pattern for `bot.water-works.in` → `http://127.0.0.1:9001`, path `^/telegram$`.
- [ ] **Prevent origin-IP bypass.** Because there's no public IP / port-forward,
      the only inbound path is the tunnel — good. Make sure the box's firewall
      denies all inbound (`ufw default deny incoming` / Windows Firewall inbound
      block). `cloudflared` only makes **outbound** connections.
- [ ] **Scope the tunnel token.** Use a **named tunnel** (you do) with its own
      credentials file; don't reuse it across services. Keep the `.json`
      credentials file `chmod 600`, never commit it (it's under
      `~/.cloudflared/`, not the repo — verify with `git status`).
- [ ] **Run cloudflared as a service** with auto-restart and log to a file you
      monitor (`cloudflared service install`). Pin/update `cloudflared` regularly.
- [ ] Add **Cloudflare Access** in front of the tunnel hostnames (§7) so even a
      leaked tunnel hostname can't be hit without a valid service token / identity.

---

## 6. SECURITY HEADERS + HARDENING

Two layers: Django sets app-level headers; Cloudflare (Transform Rules) sets the
edge headers uniformly across all hostnames (incl. Vercel).

### 6.1 Django (already mostly set)

`settings.py` already sets: `SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS=DENY`,
`SECURE_REFERRER_POLICY`, HSTS (prod), SSL redirect (prod), secure cookies. Add a
Permissions-Policy via middleware if you want it from the origin too. Good as is.

### 6.2 Cloudflare — Response Header Transform Rule (edge, covers Vercel + API)

Rules → **Transform Rules → Modify Response Header** → Add these (When incoming
requests match `hostname in {"app.water-works.in" "api.water-works.in"}`):

| Header                       | Value                                                      |
| ---------------------------- | ---------------------------------------------------------- |
| `Strict-Transport-Security`  | `max-age=31536000; includeSubDomains; preload`             |
| `X-Content-Type-Options`     | `nosniff`                                                  |
| `X-Frame-Options`            | `DENY`                                                     |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                          |
| `Permissions-Policy`         | `camera=(self), microphone=(), geolocation=(), payment=()` |
| `Cross-Origin-Opener-Policy` | `same-origin`                                              |

> `camera=(self)` is needed because the HR face check-in uses the webcam on
> `app.water-works.in`. Keep everything else off.

### 6.3 Content-Security-Policy (set at the frontend / Vercel)

CSP is best set where you know the asset origins — Vercel (`next.config.js`
headers or `vercel.json`). Start in **report-only**, then enforce:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://api.telegram.org;
  connect-src 'self' https://api.water-works.in;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests;
```

- [ ] `connect-src` must include `https://api.water-works.in` (the app's only
      backend) and **not** `ai.water-works.in` (browser never calls it directly).
- [ ] `frame-ancestors 'none'` (belt-and-suspenders with `X-Frame-Options`).
- [ ] Deploy as `Content-Security-Policy-Report-Only` first, watch the console,
      then flip to enforcing.

---

## 7. ZERO TRUST — Cloudflare Access (recommended for `ai` + internal tools)

Put `ai.water-works.in` (and the API docs, `/metrics`, any internal tool) behind
Cloudflare Access so requests must present a valid credential _at the edge_,
before they ever reach the tunnel.

### 7.1 AI service — Service-Token policy (machine-to-machine)

- [ ] Zero Trust → Access → **Service Auth → Create Service Token**
      (`render-to-ai`). Save the `CF-Access-Client-Id` / `CF-Access-Client-Secret`.
- [ ] Zero Trust → Access → **Applications → Add → Self-hosted**: - Application domain: `ai.water-works.in` - Path: leave broad, but add a **Bypass** policy for `/health` (probes). - Policy: **Action = Service Auth**, Include = _the service token above_.
- [ ] In Django, send the Access service-token headers on every face-ai call
      (in addition to `X-API-Key`):
  ```python
  # wherever the backend calls face-ai
  headers = {
      "X-API-Key": settings.FACE_AI_API_KEY,
      "CF-Access-Client-Id": settings.CF_ACCESS_CLIENT_ID,
      "CF-Access-Client-Secret": settings.CF_ACCESS_CLIENT_SECRET,
  }
  ```
  Now a leaked `X-API-Key` alone is useless — Cloudflare blocks the request
  before the origin unless the Access service token is also present.

### 7.2 Internal tools / API docs — identity policy (humans)

- [ ] Add an Access application for `/api/v1/docs`, `/metrics`, or any admin/ops
      hostname with **Include = Emails ending in @your-domain** (or a specific
      list, e.g. `rithvin1504@gmail.com`) + one-time-PIN or Google login.
- [ ] This gives you SSO-gated internal surfaces without building auth for them.

---

## 8. RATE LIMITING STRATEGY (thresholds per endpoint)

Two rings: **Cloudflare** (edge, IP-based, sheds volumetric abuse) and
**app** (DRF/slowapi, identity-based, precise). Configure both.

### 8.1 Cloudflare rate-limiting rules

Security → WAF → Rate limiting rules.

| Name        | Expression (match)                                                                              | Threshold | Period | Action            |
| ----------- | ----------------------------------------------------------------------------------------------- | --------- | ------ | ----------------- |
| api-login   | `http.host eq "api.water-works.in" and http.request.uri.path contains "/auth/login"`            | 10        | 1 min  | Block 15 min      |
| api-general | `http.host eq "api.water-works.in"`                                                             | 600       | 1 min  | Managed Challenge |
| api-write   | `http.host eq "api.water-works.in" and http.request.method in {"POST" "PUT" "PATCH" "DELETE"}`  | 120       | 1 min  | Block 10 min      |
| ai-verify   | `http.host eq "ai.water-works.in"`                                                              | 40        | 1 min  | Block 10 min      |
| bot-webhook | `http.host eq "bot.water-works.in"`                                                             | 60        | 1 min  | Block 5 min       |
| hr-checkin  | `http.host eq "api.water-works.in" and http.request.uri.path contains "/hr/attendance/checkin"` | 20        | 1 min  | Managed Challenge |

(Characterise by `cf.colo` / `ip.src` — the default. Raise once you see real
traffic; start conservative.)

### 8.2 App-level (source of truth for per-user limits)

Already in `settings.py` `DEFAULT_THROTTLE_RATES`:

| Scope            | Rate      | Applies to           |
| ---------------- | --------- | -------------------- |
| `login`          | 10/min    | login/refresh views  |
| `password_reset` | 5/hour    | reset request        |
| `ingestion`      | 60/min    | bot bill ingest      |
| `hr_checkin`     | 20/min    | public face check-in |
| `user`           | 1000/hour | authenticated API    |
| `anon`           | 100/hour  | unauthenticated API  |

- face-ai: `verify-face` 30/min, `enroll-face` 10/min via slowapi (§3).
- bot: Telegram enforces `max_connections`; add the chat-ID allowlist (§2) as the
  real limiter (only known users can drive load).

Tune with the rule: **edge limit ≈ 1.5–2× the app limit** so the app throttle is
what users normally hit and Cloudflare only catches floods.

---

## 9. LOGGING + MONITORING

### 9.1 What to log

- [ ] **Django** already emits structured logs (`LOG_FORMAT=json` in prod) with a
      per-request id, actor, tenant (`shared.logging_utils`, `ObservabilityMiddleware`).
      Set `LOG_FORMAT=json` and ship to a collector. Log: auth successes/failures,
      lockouts (`AUTH_LOCKOUT_*`), 4xx/5xx, slow requests (`SLOW_REQUEST_MS`),
      throttle hits, service-token auth attempts.
- [ ] **Never log**: JWTs, service tokens, `FACE_AI_API_KEY`, `WEBHOOK_SECRET`,
      the Telegram bot token, raw image bytes/base64, or full PII.
- [ ] **face-ai**: log request id, endpoint, latency, liveness result, and
      401/413/429 counts — not the image.
- [ ] **bot**: log update id, chat id, command, outcome; not message content of
      bills beyond what's needed.

### 9.2 Where to monitor

- [ ] **Cloudflare** → Security → Events (WAF/rate-limit/bot hits), Analytics →
      Security. Set **Notifications** (Zero Trust + WAF) for spikes, and Logpush
      (Pro+/Enterprise) to R2/your SIEM if you want raw logs.
- [ ] **Render** → service Logs + Metrics; wire log drain to your collector.
- [ ] **Cloudflare Access** → Logs (who reached `ai`/docs).
- [ ] Health probes: `GET /healthz`, `/readyz` (Django), `/health` (face-ai, bot)
      into an uptime monitor (UptimeRobot / Better Uptime) → alert to Telegram.

### 9.3 Abuse patterns to alert on

- [ ] Surge of 401/403 on `api` login (credential stuffing) → tighten `login` rate.
- [ ] 401s on `ai` `X-API-Key` (key probing) → rotate key + verify Access is on.
- [ ] 403 spike on `bot` (spoofed webhook attempts) → confirm secret still set;
      it's already being rejected, but a spike means someone found the hostname.
- [ ] Repeated 413/429 on `ai` (DoS via huge images) → lower size cap / rate.
- [ ] Lockout events (`AUTH_LOCKOUT_*`) clustering on one account → notify operator.
- [ ] Sudden geo shift in `app` traffic → tighten §1.5 geo rule.

---

## Implementation order (do it in this sequence)

1. **§0** — rotate the committed Face-AI key, remove hardcoded secrets, kill wildcard CORS.
2. **§4.1–4.2** — correct CORS/ALLOWED_HOSTS to `*.water-works.in`, add the prod startup guard.
3. **§2** — regenerate + register the Telegram webhook secret, add the chat-ID allowlist.
4. **§3** — fail-closed auth, size caps, slowapi on face-ai.
5. **§1** — Cloudflare SSL Full(strict), WAF managed + custom rules, bot protection.
6. **§8** — Cloudflare + app rate limits.
7. **§5** — tunnel ingress lockdown + loopback bind + host firewall.
8. **§7** — Cloudflare Access service token for `ai`, identity gate for docs/tools.
9. **§6** — edge security headers + CSP (report-only → enforce).
10. **§9** — turn on JSON logging, log drains, notifications, uptime + abuse alerts.

## Verification

```bash
# Bot: spoofed webhook (no secret) must be rejected
curl -si https://bot.water-works.in/telegram -X POST -d '{}' | head -1   # expect 403

# AI: no key must be rejected (after fail-closed)
curl -si https://ai.water-works.in/verify-face -X POST | head -1          # expect 401/403

# AI: health still open for probes
curl -si https://ai.water-works.in/health | head -1                       # expect 200

# API: docs must not be public
curl -si https://api.water-works.in/api/v1/docs/ | head -1                # expect 403/challenge

# Headers present
curl -sI https://app.water-works.in | grep -iE "strict-transport|content-security|x-frame"

# Origin not reachable directly (no grey-cloud leak): nslookup should only show Cloudflare IPs
nslookup ai.water-works.in
```
