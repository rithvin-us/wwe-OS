"""Environment configuration helpers.

Secrets and deployment-specific values come from environment variables only —
never hardcoded. This tiny reader keeps the dependency surface small.
"""

from __future__ import annotations

import os


class ImproperlyConfigured(Exception):
    """Raised when a required environment variable is missing."""


_TRUTHY = {"1", "true", "yes", "on"}


def env_str(key: str, default: str | None = None, *, required: bool = False) -> str | None:
    value = os.environ.get(key, default)
    if required and (value is None or value == ""):
        raise ImproperlyConfigured(f"Required environment variable '{key}' is not set.")
    return value


def env_bool(key: str, default: bool = False) -> bool:
    raw = os.environ.get(key)
    if raw is None:
        return default
    return raw.strip().lower() in _TRUTHY


def env_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if raw is None or raw == "":
        return default
    return int(raw)


def env_list(key: str, default: list[str] | None = None) -> list[str]:
    raw = os.environ.get(key)
    if not raw:
        return list(default or [])
    return [item.strip() for item in raw.split(",") if item.strip()]
