"""
Django settings for the WWE OS platform kernel.

Production-shaped, environment-driven, multi-tenant, secure by default.
Only platform capabilities live here — no business modules.
"""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

import dj_database_url

from config.env import env_bool, env_int, env_list, env_str

BASE_DIR = Path(__file__).resolve().parent.parent

# --------------------------------------------------------------------------- #
# Core
# --------------------------------------------------------------------------- #
SECRET_KEY = env_str("DJANGO_SECRET_KEY") or env_str("SECRET_KEY") or "insecure-dev-key-change-me"
DEBUG = env_bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
APP_ENV = env_str("APP_ENV", default="development")

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

# Platform capabilities only. Business modules are never installed here.
LOCAL_APPS = [
    "shared",
    "tenancy",
    "users",
    "auth",
    "permissions",
    "roles",
    "audit",
    "notifications",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

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
# Logging (structured, level via env)
# --------------------------------------------------------------------------- #
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "standard"},
    },
    "root": {"handlers": ["console"], "level": env_str("LOG_LEVEL", "INFO")},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
        "platform": {"handlers": ["console"], "level": env_str("LOG_LEVEL", "INFO")},
    },
}
