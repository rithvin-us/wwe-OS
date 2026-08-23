"""Structured face check-in diagnostics — shared by `manage.py face_doctor`
(CLI) and the Maintenance dashboard's diagnostics panel (API).

The one failure mode that breaks check-in silently is a mismatch between the
vector space of the ENROLLED templates and the vector space the VERIFY path
now produces: `cosine_similarity` returns 0.0 for unequal-length vectors, so
every employee scores 0.0 and nobody is ever recognised, with no error
raised. This module surfaces exactly that, plus the config that causes it.
See docs/specs/hr-migration.md and services/face-ai for the two-pipeline design.
"""

from __future__ import annotations

import json
from collections import Counter
from typing import Any

from hr.backend.services.face_config import FaceSettings, get_settings

STATUS_HEALTHY = "healthy"
STATUS_WARNING = "warning"
STATUS_BROKEN = "broken"


def run_face_diagnostics(timeout: float = 5.0) -> dict[str, Any]:
    """Read-only. Never changes an embedding, an employee or a setting."""
    settings = get_settings()
    problems: list[str] = []
    warnings: list[str] = []

    engine = (settings.FACE_ENGINE or "stub").lower()
    config: dict[str, Any] = {
        "engine": engine,
        "model": settings.FACE_MODEL,
        "match_threshold": settings.FACE_MATCH_THRESHOLD,
        "identify_margin": settings.FACE_IDENTIFY_MARGIN,
    }

    if engine == "stub":
        warnings.append(
            "FACE_ENGINE=stub — matching uses a pseudo-embedding, NOT a real face model. "
            "Fine for tests; never rely on it for real attendance."
        )
    if engine == "http":
        config["face_ai_url"] = settings.FACE_AI_URL
        config["face_ai_api_key_set"] = bool(settings.FACE_AI_API_KEY)
        config["fallback_stub"] = settings.FACE_AI_FALLBACK_STUB
        if settings.FACE_AI_FALLBACK_STUB:
            problems.append(
                "HR_FACE_AI_FALLBACK_STUB=true: if face-ai is unreachable or the API key "
                "is wrong, the backend silently substitutes a 16-dim stub embedding. Against "
                "real 512-dim enrolled templates that scores 0.0 for EVERYONE — check-in "
                "fails with no error. Set it false in production so failures 503."
            )
        if not settings.FACE_AI_API_KEY:
            warnings.append(
                "HR_FACE_AI_API_KEY is blank. If face-ai has FACE_AI_API_KEY set, every "
                "call is rejected 401 (then 503, or a silent stub match if fallback is on)."
            )

    dims, unreadable, total = _gallery_dims()
    gallery: dict[str, Any] = {
        "enrolled": total,
        "unreadable": unreadable,
        "dimensions": dict(Counter(sorted(dims))),
    }
    if total == 0:
        problems.append(
            "No employees have a face template. Enrol at least one reference photo "
            "before check-in can match anyone."
        )
    if unreadable:
        problems.append(
            f"{unreadable} stored template(s) are not valid JSON float lists — those "
            "employees can never match. Re-enrol them."
        )
    stored_dims = sorted(dims)
    if dims and len(set(stored_dims)) > 1:
        problems.append(
            f"Enrolled templates have MIXED dimensions {sorted(set(stored_dims))}. They "
            "were produced by different engines/models; templates of one dimension cannot "
            "match a probe of another (cosine=0.0). Re-enrol everyone through the SAME "
            "pipeline used at check-in."
        )

    live: dict[str, Any] = {}
    if engine == "http":
        live_dim, ver_err, live_meta = _probe_face_ai(settings, timeout)
        live = {**live_meta, "embedding_dim": live_dim, "error": ver_err}
        if ver_err:
            problems.append(f"Could not read face-ai /version: {ver_err}")
        elif live_dim is not None:
            enrolled_set = set(stored_dims)
            if enrolled_set and live_dim not in enrolled_set:
                problems.append(
                    f"DIMENSION MISMATCH: face-ai now produces {live_dim}-dim vectors but "
                    f"enrolled templates are {sorted(enrolled_set)}-dim. Verify embeddings "
                    "will never match the gallery -> 'Face not recognized' for everyone. "
                    "Re-enrol all employees through the current face-ai, or restore the model."
                )

    status = STATUS_BROKEN if problems else (STATUS_WARNING if warnings else STATUS_HEALTHY)
    return {
        "status": status,
        "config": config,
        "gallery": gallery,
        "live": live,
        "problems": problems,
        "warnings": warnings,
    }


def _gallery_dims() -> tuple[list[int], int, int]:
    """Return (list of stored embedding dims, unreadable count, total enrolled).

    Imported lazily so diagnostics still run (and report config) even if the
    DB/model layer is not ready.
    """
    from hr.backend.repositories import EmployeeRepository

    dims: list[int] = []
    unreadable = 0
    rows = list(EmployeeRepository().enrolled_employees())
    for emp in rows:
        try:
            vec = json.loads(emp.face_embedding)
        except (ValueError, TypeError):
            unreadable += 1
            continue
        if isinstance(vec, list) and vec:
            dims.append(len(vec))
        else:
            unreadable += 1
    return dims, unreadable, len(rows)


def _probe_face_ai(
    settings: FaceSettings, timeout: float
) -> tuple[int | None, str | None, dict[str, Any]]:
    """GET the face-ai /version; return (embedding_dim, error, {service, engine, model})."""
    try:
        import httpx

        headers = {"X-API-Key": settings.FACE_AI_API_KEY} if settings.FACE_AI_API_KEY else {}
        resp = httpx.get(
            settings.FACE_AI_URL.rstrip("/") + "/version",
            headers=headers,
            timeout=timeout,
        )
        resp.raise_for_status()
        body = resp.json()
        dim = body.get("embedding_dim")
        meta = {
            "service": body.get("service"),
            "engine": body.get("engine"),
            "model": body.get("model"),
        }
        return (int(dim) if dim else None), None, meta
    except Exception as exc:  # noqa: BLE001 - diagnostics must never raise
        return None, f"{type(exc).__name__}: {exc}", {}
