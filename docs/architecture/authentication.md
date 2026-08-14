# Authentication

Stateless JWT authentication built to accept external identity providers
(OAuth, Google, Azure AD, LDAP, SAML) later without redesign — a federated
identity record would link to the same `User`.

## Tokens

- **Access token** — short-lived (default 15 min), sent as `Authorization: Bearer <token>`.
- **Refresh token** — longer-lived (default 7 days; 30 with "remember me"),
  exchanged for new access tokens. Rotation is on; the previous refresh is
  blacklisted after use.

## Flows

**Login** (`POST /api/v1/auth/login/`)

1. Reject early if the account is locked (too many recent failures).
2. Verify credentials (Argon2). Record a `LoginAttempt` either way.
3. On success: clear the failure counter, issue an access/refresh pair, create a
   `UserSession` (device, IP, user agent, refresh JTI), set `last_login`, and
   publish `user.logged_in`.

**Refresh** (`POST /api/v1/auth/refresh/`) — rotate the refresh token, return a
new access token.

**Logout** (`POST /api/v1/auth/logout/`) — blacklist the given refresh token and
revoke its session.

**Logout everywhere** (`POST /api/v1/auth/logout-everywhere/`) — blacklist all of
the user's outstanding tokens and revoke all sessions.

**Register** (`POST /api/v1/auth/register/`) — create the user and email a
verification token.

**Email verification** (`POST /api/v1/auth/email/verify/`).

**Password reset** — request (`.../password/reset/`) emails a single-use, hashed,
expiring token; confirm (`.../password/reset/confirm/`) sets the new password and
signs the user out everywhere. The request endpoint never reveals whether an
email exists.

**Change password** (`.../password/change/`) — requires the current password;
signs the user out everywhere on success.

## Protections

- **Password policy** — minimum length plus complexity (upper/lower/digit/symbol),
  Argon2 hashing, and a `MAX_PASSWORD_LENGTH` bound on submitted passwords so an
  oversized input cannot turn one request into a hashing DoS.
- **Account lockout with exponential backoff** — after `AUTH_LOCKOUT_MAX_ATTEMPTS`
  failures within the window, the identity is throttled with a backoff that grows
  per further failure (`min(AUTH_LOCKOUT_BASE_BACKOFF_SECONDS *
  AUTH_LOCKOUT_BACKOFF_FACTOR^extra, AUTH_LOCKOUT_MAX_BACKOFF_SECONDS)`), cache-backed.
  It is per-account for password login and per-IP for face login, and always
  self-expires — never a permanent hard lock on a real account.
- **Rate limiting** — scoped throttles on login and password-reset endpoints
  (per-IP), combined with the per-account/per-IP lockout above, plus global
  user/anon throttles. All thresholds are environment-configurable.
- **Device tracking** — every session records device label, IP, and user agent.
- **Single-use tokens** — reset/verification tokens are hashed at rest, expire,
  and can be consumed once.

## Where the tenant comes from

`PlatformJWTAuthentication` resolves the user from the access token and pushes
the user's tenant into the request context, so tenant scoping applies to every
authenticated API call.
