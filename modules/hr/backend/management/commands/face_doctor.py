"""Diagnose why self-service face check-in is not matching.

    python manage.py face_doctor

Read-only. It never changes an embedding, an employee or a setting — it only
reports. The one failure mode that breaks check-in silently is a mismatch
between the vector space of the ENROLLED templates and the vector space the
VERIFY path now produces: `cosine_similarity` returns 0.0 for unequal-length
vectors, so every employee scores 0.0 and nobody is ever recognised, with no
error raised. This command surfaces exactly that, plus the config that causes it.

What it checks
  1. Face-engine wiring (HR_FACE_ENGINE, model, thresholds, fail-open risks).
  2. The enrolled gallery: how many employees are enrolled and the distribution
     of their stored embedding dimensions (a healthy gallery has ONE dimension).
  3. When FACE_ENGINE=http, the live face-ai `/version` — its engine, model and
     `embedding_dim` — and whether that dimension equals what is stored. A
     difference is the root cause of "Face not recognized" for everyone.

Exit status is non-zero when a check-in-breaking problem is found, so it can be
wired into a health check or run after a config change.

See docs/specs/hr-migration.md and services/face-ai for the two-pipeline design.
"""

from __future__ import annotations

import json
from collections import Counter

from django.core.management.base import BaseCommand

from hr.backend.services.face_config import get_settings

# Exit codes: 0 = healthy, 1 = check-in-breaking problem, 2 = warnings only.
EXIT_OK = 0
EXIT_BROKEN = 1
EXIT_WARN = 2


class Command(BaseCommand):
    help = "Diagnose face check-in matching (engine wiring, enrolled dims, live face-ai dim)."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--timeout",
            type=float,
            default=5.0,
            help="Seconds to wait for the face-ai /version probe (FACE_ENGINE=http).",
        )

    def handle(self, *args, **options) -> None:
        settings = get_settings()
        problems: list[str] = []
        warnings: list[str] = []

        self._section("Face engine configuration")
        engine = (settings.FACE_ENGINE or "stub").lower()
        self._kv("HR_FACE_ENGINE", engine)
        self._kv("FACE_MODEL", settings.FACE_MODEL)
        self._kv("FACE_MATCH_THRESHOLD", settings.FACE_MATCH_THRESHOLD)
        self._kv("FACE_IDENTIFY_MARGIN", settings.FACE_IDENTIFY_MARGIN)

        if engine == "stub":
            warnings.append(
                "FACE_ENGINE=stub — matching uses a pseudo-embedding, NOT a real face model. "
                "Fine for tests; never rely on it for real attendance."
            )
        if engine == "http":
            self._kv("FACE_AI_URL", settings.FACE_AI_URL)
            self._kv("FACE_AI_API_KEY set", bool(settings.FACE_AI_API_KEY))
            self._kv("FACE_AI_FALLBACK_STUB", settings.FACE_AI_FALLBACK_STUB)
            if settings.FACE_AI_FALLBACK_STUB:
                problems.append(
                    "HR_FACE_AI_FALLBACK_STUB=true: if face-ai is unreachable or the API "
                    "key is wrong, the backend silently substitutes a 16-dim stub embedding. "
                    "Against real 512-dim enrolled templates that scores 0.0 for EVERYONE — "
                    "check-in fails with no error. Set it false in production so failures 503."
                )
            if not settings.FACE_AI_API_KEY:
                warnings.append(
                    "HR_FACE_AI_API_KEY is blank. If face-ai has FACE_AI_API_KEY set, every "
                    "call is rejected 401 (then 503, or a silent stub match if fallback is on)."
                )

        # -- 2. enrolled gallery ------------------------------------------------
        self._section("Enrolled gallery")
        dims, unreadable, total = self._gallery_dims()
        self._kv("Employees enrolled", total)
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
        if dims:
            self._kv("Stored embedding dimensions", dict(Counter(stored_dims)))
            if len(set(stored_dims)) > 1:
                problems.append(
                    f"Enrolled templates have MIXED dimensions {sorted(set(stored_dims))}. "
                    "They were produced by different engines/models; templates of one dimension "
                    "cannot match a probe of another (cosine=0.0). Re-enrol everyone through the "
                    "SAME pipeline used at check-in."
                )

        # -- 3. live face-ai dimension -----------------------------------------
        live_dim = None
        if engine == "http":
            self._section("Live face-ai probe (/version)")
            live_dim, ver_err = self._probe_face_ai(settings, options["timeout"])
            if ver_err:
                problems.append(f"Could not read face-ai /version: {ver_err}")
            elif live_dim is not None:
                enrolled_set = set(stored_dims)
                if enrolled_set and live_dim not in enrolled_set:
                    problems.append(
                        f"DIMENSION MISMATCH: face-ai now produces {live_dim}-dim vectors but "
                        f"enrolled templates are {sorted(enrolled_set)}-dim. Verify embeddings "
                        f"will never match the gallery -> 'Face not recognized' for everyone. "
                        f"Re-enrol all employees through the current face-ai, or restore the model."
                    )
                elif enrolled_set:
                    msg = f"  OK: live dim {live_dim} matches all enrolled templates."
                    self.stdout.write(self.style.SUCCESS(msg))

        # -- verdict ------------------------------------------------------------
        self._section("Verdict")
        for w in warnings:
            self.stdout.write(self.style.WARNING(f"  WARN: {w}"))
        for p in problems:
            self.stdout.write(self.style.ERROR(f"  PROBLEM: {p}"))
        if problems:
            summary = f"\n{len(problems)} check-in-breaking problem(s) found."
            self.stdout.write(self.style.ERROR(summary))
            raise SystemExit(EXIT_BROKEN)
        if warnings:
            summary = f"\n{len(warnings)} warning(s); no hard failures."
            self.stdout.write(self.style.WARNING(summary))
            raise SystemExit(EXIT_WARN)
        self.stdout.write(self.style.SUCCESS("\nFace check-in pipeline looks healthy."))
        raise SystemExit(EXIT_OK)

    # -- helpers ---------------------------------------------------------------
    def _gallery_dims(self) -> tuple[list[int], int, int]:
        """Return (list of stored embedding dims, unreadable count, total enrolled).

        Imported lazily so the command still runs (and reports the config) even
        if the DB/model layer is not ready.
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

    def _probe_face_ai(self, settings, timeout: float) -> tuple[int | None, str | None]:
        """GET the face-ai /version; return (embedding_dim, error)."""
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
            self._kv("service", body.get("service"))
            self._kv("engine", body.get("engine"))
            self._kv("model", body.get("model"))
            self._kv("embedding_dim", body.get("embedding_dim"))
            dim = body.get("embedding_dim")
            return (int(dim) if dim else None), None
        except Exception as exc:  # noqa: BLE001 - diagnostics must never raise
            return None, f"{type(exc).__name__}: {exc}"

    def _section(self, title: str) -> None:
        self.stdout.write(self.style.MIGRATE_HEADING(f"\n== {title} =="))

    def _kv(self, key: str, value) -> None:
        self.stdout.write(f"  {key}: {value}")
