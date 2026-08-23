"""Platform error types and the DRF exception handler.

Every error leaves the API in one shape:
    {"success": false, "error": {"code", "message", "details"}}
"""

from __future__ import annotations

import logging
from typing import Any

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger("platform.errors")


class PlatformError(APIException):
    """Base for domain errors raised by services."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "error"
    default_detail = "A platform error occurred."


class ValidationError(PlatformError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "validation_error"
    default_detail = "The submitted data is invalid."


class NotFoundError(PlatformError):
    status_code = status.HTTP_404_NOT_FOUND
    default_code = "not_found"
    default_detail = "The requested resource was not found."


class ConflictError(PlatformError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "conflict"
    default_detail = "The request conflicts with the current state."


class PermissionDeniedError(PlatformError):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "permission_denied"
    default_detail = "You do not have permission to perform this action."


class AuthenticationFailedError(PlatformError):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_code = "authentication_failed"
    default_detail = "Authentication failed."


class RateLimitedError(PlatformError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_code = "rate_limited"
    default_detail = "Too many requests. Please try again later."


def standard_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = drf_exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled exception in API")
        return Response(
            {
                "success": False,
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected error occurred.",
                    "details": None,
                },
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = response.data
    code = getattr(exc, "default_code", "error")
    message = "Request failed."
    details: Any = None

    if isinstance(exc, DRFValidationError) and not isinstance(exc, ValidationError):
        # A plain serializer's `is_valid(raise_exception=True)` raises DRF's
        # own ValidationError, which defaults to 400 — but the platform's
        # documented contract (docs/api/platform-api.md) is 422 for field
        # validation failures, matching the platform ValidationError above.
        # Normalize so every validation failure looks the same over the API,
        # regardless of which layer raised it.
        logger.debug("DRF validation error normalized to 422: %s", exc.detail)
        response.status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
        code = "validation_error"

    if isinstance(detail, dict) and "detail" in detail and len(detail) == 1:
        message = str(detail["detail"])
    elif isinstance(detail, dict):
        first_msg = None
        for val in detail.values():
            if isinstance(val, list) and val and isinstance(val[0], str):
                first_msg = val[0]
                break
            elif isinstance(val, str):
                first_msg = val
                break
        message = first_msg if first_msg else "One or more fields are invalid."
        details = detail
    elif isinstance(detail, list):
        message = "; ".join(str(item) for item in detail)
    else:
        message = str(detail)

    response.data = {
        "success": False,
        "error": {"code": code, "message": message, "details": details},
    }
    return response
