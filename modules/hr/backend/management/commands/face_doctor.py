"""Diagnose why self-service face check-in is not matching.

    python manage.py face_doctor

Read-only. It never changes an embedding, an employee or a setting — it only
reports. The one failure mode that breaks check-in silently is a mismatch
between the vector space of the ENROLLED templates and the vector space the
VERIFY path now produces: `cosine_similarity` returns 0.0 for unequal-length
vectors, so every employee scores 0.0 and nobody is ever recognised, with no
error raised. This command surfaces exactly that, plus the config that causes it.

The check logic itself lives in `hr.backend.services.face_doctor` — this
command is a thin CLI wrapper around it; the Maintenance dashboard's
diagnostics panel calls the same function over the API
(`GET /api/v1/hr/face/diagnostics/`) so both surfaces can never drift.

Exit status is non-zero when a check-in-breaking problem is found, so it can be
wired into a health check or run after a config change.

See docs/specs/hr-migration.md and services/face-ai for the two-pipeline design.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from hr.backend.services.face_doctor import STATUS_BROKEN, STATUS_WARNING, run_face_diagnostics

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
        report = run_face_diagnostics(timeout=options["timeout"])

        self._section("Face engine configuration")
        for key, value in report["config"].items():
            self._kv(key, value)

        self._section("Enrolled gallery")
        gallery = report["gallery"]
        self._kv("Employees enrolled", gallery["enrolled"])
        if gallery["dimensions"]:
            self._kv("Stored embedding dimensions", gallery["dimensions"])

        if report["live"]:
            self._section("Live face-ai probe (/version)")
            for key, value in report["live"].items():
                self._kv(key, value)
            if not report["live"].get("error") and report["live"].get("embedding_dim"):
                self.stdout.write(self.style.SUCCESS("  OK: face-ai reachable and dim recorded."))

        self._section("Verdict")
        for w in report["warnings"]:
            self.stdout.write(self.style.WARNING(f"  WARN: {w}"))
        for p in report["problems"]:
            self.stdout.write(self.style.ERROR(f"  PROBLEM: {p}"))

        if report["status"] == STATUS_BROKEN:
            summary = f"\n{len(report['problems'])} check-in-breaking problem(s) found."
            self.stdout.write(self.style.ERROR(summary))
            raise SystemExit(EXIT_BROKEN)
        if report["status"] == STATUS_WARNING:
            summary = f"\n{len(report['warnings'])} warning(s); no hard failures."
            self.stdout.write(self.style.WARNING(summary))
            raise SystemExit(EXIT_WARN)
        self.stdout.write(self.style.SUCCESS("\nFace check-in pipeline looks healthy."))
        raise SystemExit(EXIT_OK)

    def _section(self, title: str) -> None:
        self.stdout.write(self.style.MIGRATE_HEADING(f"\n== {title} =="))

    def _kv(self, key: str, value) -> None:
        self.stdout.write(f"  {key}: {value}")
