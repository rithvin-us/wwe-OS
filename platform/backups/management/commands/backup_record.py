"""Record a backup run into the ledger.

Meant to be called by the actual backup job (cron / CI) after it runs pg_dump,
syncs object storage, etc. — the application never performs the backup, it only
records what infrastructure reported.

    python manage.py backup_record --kind database --status success \
        --size-bytes 10485760 --location r2://backups/db/2026-08-12.sql.gz

`--verified` should be passed only by a restore-test job that actually restored
and checked the artifact — not by the backup job itself.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.utils import timezone

from backups.models import BackupKind, BackupStatus
from backups.services import BackupService


class Command(BaseCommand):
    help = "Record a backup run reported by the backup infrastructure."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--kind", required=True, choices=BackupKind.values)
        parser.add_argument("--status", required=True, choices=BackupStatus.values)
        parser.add_argument("--size-bytes", type=int, default=None)
        parser.add_argument("--location", default="")
        parser.add_argument("--message", default="")
        parser.add_argument(
            "--verified",
            action="store_true",
            help="Only for a restore-test job that actually restored the artifact.",
        )

    def handle(self, *args, **options) -> None:
        now = timezone.now()
        run = BackupService().record(
            kind=options["kind"],
            status=options["status"],
            started_at=now,
            finished_at=now if options["status"] != BackupStatus.RUNNING else None,
            size_bytes=options["size_bytes"],
            location=options["location"],
            message=options["message"],
            verified=options["verified"],
        )
        self.stdout.write(
            self.style.SUCCESS(f"Recorded backup run {run.id} ({run.kind}/{run.status}).")
        )
