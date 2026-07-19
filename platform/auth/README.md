# Platform · Auth

Authentication for the entire platform: credential login, token issuance and
refresh, session management, SSO/OAuth providers, MFA, password policy.

- Owns: identity verification, tokens, sessions.
- Does not own: what a user may do (`permissions/`), who the user is (`users/`).
- Consumed by: every app, every module, every service.
