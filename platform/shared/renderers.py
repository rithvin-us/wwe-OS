"""Standard JSON renderer — wraps successful payloads in a consistent envelope.

    {"success": true, "data": ...}

Paginated responses and error responses are already enveloped upstream and
pass through untouched.
"""

from __future__ import annotations

from typing import Any

from rest_framework.renderers import JSONRenderer


class StandardJSONRenderer(JSONRenderer):
    def render(self, data: Any, accepted_media_type=None, renderer_context=None) -> bytes:
        renderer_context = renderer_context or {}
        response = renderer_context.get("response")

        already_enveloped = isinstance(data, dict) and "success" in data
        if data is None or already_enveloped:
            payload = data if data is not None else {"success": True, "data": None}
        elif response is not None and response.status_code >= 400:
            # Errors are shaped by the exception handler; if something slips
            # through unshaped, wrap it defensively.
            payload = {"success": False, "error": data}
        else:
            payload = {"success": True, "data": data}

        return super().render(payload, accepted_media_type, renderer_context)
