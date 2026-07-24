"""Test settings — fast, isolated, deterministic.

Inherits everything from the real settings, then disables throttling, uses a
fast password hasher, keeps email in-memory, and runs on an in-memory sqlite
database so the suite needs no external services.
"""

from config.settings import *  # noqa: F401,F403
from config.settings import REST_FRAMEWORK

DEBUG = True

# The base settings hardened these while DEBUG was False at import time.
# Turn them off so the test client isn't redirected to https.
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0

# A 32+ byte signing key keeps JWT HMAC happy and quiet.
SECRET_KEY = "test-secret-key-that-is-sufficiently-long-1234567890"
SIMPLE_JWT = {**SIMPLE_JWT, "SIGNING_KEY": SECRET_KEY}  # noqa: F405

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# The test suite must never call a real AI provider — deterministic, no
# external services, no quota burn — regardless of what a developer's local
# .env has configured for real usage.
AI_DEFAULT_MODEL = "mock"
AI_FALLBACK_MODEL = ""
GEMINI_API_KEY = ""
ANTHROPIC_API_KEY = ""

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {},
}
