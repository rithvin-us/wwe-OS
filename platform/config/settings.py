"""
Django settings for the WWE OS platform kernel.

Production-shaped, environment-driven, multi-tenant, secure by default.
Only platform capabilities live here — no business modules.
"""

from __future__ import annotations

import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url

from config.env import env_bool, env_int, env_list, env_str

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

# Local (non-Docker) runs read config from the repo-root .env; Docker and
# production set real environment variables directly, which always win
# (load_dotenv never overrides an already-set variable). This runs for every
# entrypoint (manage.py, wsgi, asgi, pytest-django) since they all import
# this module first.
try:
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env")
except ImportError:
    pass

# Business modules live in the repo-root `modules/` directory (their own
# top-level package space, one Django app per module at `<slug>/backend`) —
# never inside `platform/`. Adding this to sys.path is wiring, not a business
# decision: it lets the single Django project load module apps declared in
# MODULE_APPS below without moving their code into the kernel.
if str(REPO_ROOT / "modules") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "modules"))

# --------------------------------------------------------------------------- #
# Core
# --------------------------------------------------------------------------- #
SECRET_KEY = env_str("DJANGO_SECRET_KEY") or env_str(
    "SECRET_KEY", default="django-insecure-development-placeholder-key-change-in-production-12345"
)
DEBUG = env_bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
APP_ENV = env_str("APP_ENV", default="development")

# Shared secrets for service-to-service ingestion (Telegram bot, email
# service, …). Format: "name:token,name:token". See shared/service_auth.py.
INGESTION_SERVICE_TOKENS = env_str("INGESTION_SERVICE_TOKENS", default="") or ""

# --------------------------------------------------------------------------- #
# Applications
# --------------------------------------------------------------------------- #
DJANGO_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
]

# Platform capabilities. No business logic lives in these apps — see
# CLAUDE.md rule 1. This boundary is architectural, enforced by code review
# and the "modules never import each other" rule, not by process isolation.
#
# Split around MODULE_APPS on purpose: `permissions` must sync before any
# module's own post_migrate permission sync runs, and `roles` (which grants
# the Owner role every Permission row that exists at that point) must sync
# AFTER every module's permissions are in the table — otherwise Owner would
# miss whatever a module registers. Django fires post_migrate once per app,
# in INSTALLED_APPS order, after all migrations are applied — so the only
# way to guarantee this ordering is this list's order. If a future module's
# owner-role coverage looks wrong, check this ordering first.
PLATFORM_APPS_BEFORE_MODULES = [
    "shared",
    "tenancy",
    "users",
    "auth",
    "permissions",
    "storage",
    "periods",
    "identity",
    "metadata",
    "rules",
    "auditor",  # Auditor Package Generator — distinct from "audit" (the audit log app)
    "ai",
    "search",
    "reporting",
    "tagging",
    "workflow",
    "automation",
]
PLATFORM_APPS_AFTER_MODULES = ["roles", "audit", "notifications"]

# Business module apps. Each entry is "<module>.backend" — the module's
# backend directory, loaded via the modules/ path above. A module is added
# here only once its backend is actually implemented; see docs/modules/*.md
# for the ones still unimplemented shells.
MODULE_APPS = [
    "purchase.backend",
    "documents.backend",
    "contracts.backend",
    "inventory.backend",
    "assets.backend",
]

INSTALLED_APPS = (
    DJANGO_APPS
    + THIRD_PARTY_APPS
    + PLATFORM_APPS_BEFORE_MODULES
    + MODULE_APPS
    + PLATFORM_APPS_AFTER_MODULES
)

# --------------------------------------------------------------------------- #
# Middleware
# --------------------------------------------------------------------------- #
# Stateless JWT API: no Django session/auth middleware. DRF authenticates per
# request (auth.authentication.PlatformJWTAuthentication), which also populates
# the tenant/actor context.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "shared.middleware.RequestContextMiddleware",
    "tenancy.middleware.TenantMiddleware",
    # Innermost on purpose: its access-log line runs before RequestContext
    # clears the per-request context, so it can carry actor/tenant/request id.
    "shared.middleware.ObservabilityMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
            ],
        },
    },
]

# --------------------------------------------------------------------------- #
# Database (PostgreSQL in every real environment; sqlite only for local tests)
# --------------------------------------------------------------------------- #
_database_url = env_str("DATABASE_URL")
if _database_url:
    DATABASES = {
        "default": dj_database_url.parse(
            _database_url, conn_max_age=env_int("DB_CONN_MAX_AGE", 60)
        ),
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "dev.sqlite3",
        }
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.User"

# --------------------------------------------------------------------------- #
# Authentication & password security
# --------------------------------------------------------------------------- #
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": env_int("PASSWORD_MIN_LENGTH", 10)},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {"NAME": "shared.validators.PasswordComplexityValidator"},
]

# Brute-force / account-locking policy (enforced in auth services).
AUTH_LOCKOUT_MAX_ATTEMPTS = env_int("AUTH_LOCKOUT_MAX_ATTEMPTS", 5)
AUTH_LOCKOUT_WINDOW_SECONDS = env_int("AUTH_LOCKOUT_WINDOW_SECONDS", 900)
AUTH_LOCKOUT_DURATION_SECONDS = env_int("AUTH_LOCKOUT_DURATION_SECONDS", 900)
PASSWORD_RESET_TOKEN_TTL_SECONDS = env_int("PASSWORD_RESET_TOKEN_TTL_SECONDS", 3600)
EMAIL_VERIFICATION_TTL_SECONDS = env_int("EMAIL_VERIFICATION_TTL_SECONDS", 86400)

# --------------------------------------------------------------------------- #
# REST framework
# --------------------------------------------------------------------------- #
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("auth.authentication.PlatformJWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_RENDERER_CLASSES": ("shared.renderers.StandardJSONRenderer",),
    "DEFAULT_PAGINATION_CLASS": "shared.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": env_int("API_PAGE_SIZE", 25),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "EXCEPTION_HANDLER": "shared.exceptions.standard_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.AnonRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "user": env_str("THROTTLE_USER", "1000/hour"),
        "anon": env_str("THROTTLE_ANON", "100/hour"),
        "login": env_str("THROTTLE_LOGIN", "10/minute"),
        "password_reset": env_str("THROTTLE_PASSWORD_RESET", "5/hour"),
        "ingestion": env_str("THROTTLE_INGESTION", "60/minute"),
    },
}

# --------------------------------------------------------------------------- #
# JWT (rotation + blacklist; designed so SSO/OAuth can be added later)
# --------------------------------------------------------------------------- #
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env_int("JWT_ACCESS_MINUTES", 15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env_int("JWT_REFRESH_DAYS", 7)),
    "REFRESH_TOKEN_REMEMBER_ME_LIFETIME": timedelta(days=env_int("JWT_REMEMBER_ME_DAYS", 30)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_TYPE_CLAIM": "token_type",
    "JTI_CLAIM": "jti",
}

# --------------------------------------------------------------------------- #
# OpenAPI
# --------------------------------------------------------------------------- #
SPECTACULAR_SETTINGS = {
    "TITLE": "WWE OS Platform API",
    "DESCRIPTION": "Enterprise Business Operations Platform — kernel API (Stage 1).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
    # Disambiguate the several `status` enums across models.
    "ENUM_NAME_OVERRIDES": {
        "UserStatusEnum": "users.models.UserStatus",
        "TenantStatusEnum": "tenancy.models.TenantStatus",
        "SubscriptionStatusEnum": "tenancy.models.SubscriptionStatus",
        "NotificationStatusEnum": "notifications.models.Status",
        "NotificationChannelEnum": "notifications.models.Channel",
        "NotificationPriorityEnum": "notifications.models.Priority",
    },
}

# --------------------------------------------------------------------------- #
# Caching (Redis when available; locmem otherwise — used by throttles/lockout)
# --------------------------------------------------------------------------- #
_redis_url = env_str("REDIS_URL")
if _redis_url:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": _redis_url,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "platform-locmem",
        }
    }

# --------------------------------------------------------------------------- #
# Email (Mailpit in local dev; console fallback)
# --------------------------------------------------------------------------- #
if env_str("SMTP_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = env_str("SMTP_HOST", "localhost")
    EMAIL_PORT = env_int("SMTP_PORT", 1025)
    EMAIL_HOST_USER = env_str("SMTP_USER", "") or ""
    EMAIL_HOST_PASSWORD = env_str("SMTP_PASSWORD", "") or ""
    EMAIL_USE_TLS = env_bool("SMTP_USE_TLS", default=False)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = env_str("SMTP_FROM", "noreply@wwe-os.local")

# --------------------------------------------------------------------------- #
# CORS
# --------------------------------------------------------------------------- #
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", default=["http://localhost:3000", "http://127.0.0.1:3000"]
)
CORS_ALLOW_CREDENTIALS = True

# --------------------------------------------------------------------------- #
# Security headers (hardened when not in DEBUG)
# --------------------------------------------------------------------------- #
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", default=True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", default=list(CORS_ALLOWED_ORIGINS))

# --------------------------------------------------------------------------- #
# I18N / static
# --------------------------------------------------------------------------- #
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --------------------------------------------------------------------------- #
# Object storage (platform/storage)
# --------------------------------------------------------------------------- #
# "local" stores bytes under STORAGE_LOCAL_PATH (dev/tests); "s3" | "r2" |
# "minio" use the S3 API via STORAGE_S3_* (Cloudflare R2 is S3-compatible —
# endpoint https://<account-id>.r2.cloudflarestorage.com, region "auto").
STORAGE_BACKEND = env_str("STORAGE_BACKEND", "local")
STORAGE_LOCAL_PATH = env_str("STORAGE_LOCAL_PATH", str(BASE_DIR / ".storage"))
STORAGE_MAX_UPLOAD_MB = env_int("STORAGE_MAX_UPLOAD_MB", 25)
STORAGE_ALLOWED_TYPES = set(
    env_list(
        "STORAGE_ALLOWED_TYPES",
        default=[
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/webp",
            "text/plain",
            "text/csv",
            "text/html",
            "application/json",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
    )
)
STORAGE_S3_BUCKET = env_str("STORAGE_S3_BUCKET", "") or ""
STORAGE_S3_ENDPOINT_URL = env_str("STORAGE_S3_ENDPOINT_URL", "") or ""
STORAGE_S3_REGION = env_str("STORAGE_S3_REGION", "auto")
STORAGE_S3_ACCESS_KEY_ID = env_str("STORAGE_S3_ACCESS_KEY_ID", "") or ""
STORAGE_S3_SECRET_ACCESS_KEY = env_str("STORAGE_S3_SECRET_ACCESS_KEY", "") or ""

# --------------------------------------------------------------------------- #
# AI gateway (platform/ai)
# --------------------------------------------------------------------------- #
GEMINI_API_KEY = env_str("GEMINI_API_KEY", "") or ""
ANTHROPIC_API_KEY = env_str("ANTHROPIC_API_KEY", "") or ""
# "mock" answers deterministically without keys — safe default for dev/tests.
AI_DEFAULT_MODEL = env_str("AI_DEFAULT_MODEL", "mock")
AI_FALLBACK_MODEL = env_str("AI_FALLBACK_MODEL", "") or ""
AI_TIMEOUT_SECONDS = env_int("AI_TIMEOUT_SECONDS", 30)
AI_MAX_RETRIES = env_int("AI_MAX_RETRIES", 2)
# Per-tenant calls per clock hour; 0 disables the limit.
AI_TENANT_HOURLY_LIMIT = env_int("AI_TENANT_HOURLY_LIMIT", 200)

# --------------------------------------------------------------------------- #
# Observability (structured logging, request metrics)
# --------------------------------------------------------------------------- #
# LOG_FORMAT=json emits one JSON object per line (for log aggregators);
# the default text format still carries the request id for correlation.
LOG_FORMAT = env_str("LOG_FORMAT", "text")
# Requests slower than this log at WARNING instead of INFO.
SLOW_REQUEST_MS = env_int("SLOW_REQUEST_MS", 1000)
# /metrics stays 404 until a scrape token is configured.
METRICS_TOKEN = env_str("METRICS_TOKEN", "") or ""

# --------------------------------------------------------------------------- #
# Pipeline execution engine (platform/workflow)
# --------------------------------------------------------------------------- #
PIPELINE_STEP_STALE_TIMEOUT_SECONDS = env_int("PIPELINE_STEP_STALE_TIMEOUT_SECONDS", 600)
PIPELINE_TICK_BATCH_SIZE = env_int("PIPELINE_TICK_BATCH_SIZE", 50)
PIPELINE_TICK_INTERVAL_SECONDS = env_int("PIPELINE_TICK_INTERVAL_SECONDS", 3)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "request_context": {"()": "shared.logging_utils.RequestContextFilter"},
    },
    "formatters": {
        "standard": {
            "format": "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s",
        },
        "json": {"()": "shared.logging_utils.JSONFormatter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json" if LOG_FORMAT == "json" else "standard",
            "filters": ["request_context"],
        },
    },
    "root": {"handlers": ["console"], "level": env_str("LOG_LEVEL", "INFO")},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
        "platform": {"handlers": ["console"], "level": env_str("LOG_LEVEL", "INFO")},
        "platform.requests": {
            "handlers": ["console"],
            "level": env_str("LOG_LEVEL", "INFO"),
            "propagate": False,
        },
    },
}
