"""Reusable validation building blocks.

- PasswordComplexityValidator plugs into Django's AUTH_PASSWORD_VALIDATORS.
- BaseValidator is a small service-layer validator that collects field errors
  and raises the platform ValidationError.
"""

from __future__ import annotations

import re
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.translation import gettext_lazy as _

from shared.exceptions import ValidationError

_UPPER = re.compile(r"[A-Z]")
_LOWER = re.compile(r"[a-z]")
_DIGIT = re.compile(r"\d")
_SYMBOL = re.compile(r"[^A-Za-z0-9]")


class PasswordComplexityValidator:
    """Requires upper, lower, digit, and symbol. Enterprise password policy."""

    def __init__(self, min_classes: int = 4) -> None:
        self.min_classes = min_classes

    def validate(self, password: str, user: Any = None) -> None:
        classes = sum(
            bool(pattern.search(password)) for pattern in (_UPPER, _LOWER, _DIGIT, _SYMBOL)
        )
        if classes < self.min_classes:
            raise DjangoValidationError(
                _("Password must include uppercase and lowercase letters, a number, and a symbol."),
                code="password_not_complex",
            )

    def get_help_text(self) -> str:
        return _(
            "Your password must include uppercase and lowercase letters, a number, and a symbol."
        )


class BaseValidator:
    """Collects field errors, then raises a single platform ValidationError."""

    def __init__(self) -> None:
        self.errors: dict[str, list[str]] = {}

    def add_error(self, field: str, message: str) -> None:
        self.errors.setdefault(field, []).append(message)

    def require(self, field: str, value: Any, message: str = "This field is required.") -> None:
        if value is None or value == "":
            self.add_error(field, message)

    def raise_if_errors(self) -> None:
        if self.errors:
            raise ValidationError(detail=self.errors)
