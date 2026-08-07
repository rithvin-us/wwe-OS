"""Reset demo data back to an empty slate.

Wipes the demo artifacts a walkthrough leaves behind so the next run starts
clean: raised invoices and their number counters (via each module's registered
resetter — see ``shared.demo_reset``), automation and pipeline run history, the
stored-file rows, and the files themselves under the local storage root.

Destructive by design, so it is guarded: it refuses to run against a
non-``DEBUG`` deployment unless ``--force`` is passed, and asks for
confirmation unless ``--no-input`` is given.

    python manage.py reset_demo_data                 # all tenants (dev)
    python manage.py reset_demo_data --tenant acme   # one tenant, by slug
    python manage.py reset_demo_data --force --no-input

Order matters. Module rows go first (``Invoice.file`` is ``on_delete=PROTECT``,
so an invoice must be gone before its StoredFile can be), then run history that
points at stored files, then the stored-file rows, then the bytes on disk.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from shared.demo_reset import all_demo_resetters
from tenancy.models import Tenant


class Command(BaseCommand):
    help = "Delete demo invoices, run history and stored files; recreate the empty storage root."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--tenant", default="", help="Limit to one tenant by slug (default: all tenants)."
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow the reset to run even when DEBUG is off.",
        )
        parser.add_argument(
            "--no-input",
            action="store_true",
            help="Skip the interactive confirmation prompt.",
        )

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "Refusing to reset demo data with DEBUG off. Re-run with --force if you are "
                "certain this is not production."
            )

        tenant = None
        if options["tenant"]:
            tenant = Tenant.objects.filter(slug=options["tenant"]).first()
            if tenant is None:
                raise CommandError(f"No tenant with slug '{options['tenant']}'.")

        scope = f"tenant '{tenant.slug}'" if tenant else "ALL tenants"
        if not options["no_input"]:
            answer = input(f"This will permanently delete demo data for {scope}. Continue? [y/N] ")
            if answer.strip().lower() not in {"y", "yes"}:
                self.stdout.write("Aborted.")
                return

        # 1. Module-owned rows (invoices + counters, etc.) — before StoredFiles.
        for label, resetter in all_demo_resetters():
            resetter(tenant=tenant)
            self.stdout.write(f"  reset module data: {label}")

        # 2. Run history that references stored files.
        self._delete_run_history(tenant)

        # 3. Stored-file rows.
        files_removed = self._delete_stored_files(tenant)
        self.stdout.write(f"  deleted stored-file rows: {files_removed}")

        # 4. Business periods + their manifests (recomputed on next use).
        self._delete_periods(tenant)

        # 5. The bytes on disk. A per-tenant reset never wipes the shared root
        #    (other tenants live there); a full reset recreates it empty.
        if tenant is None:
            for root in self._local_roots():
                self._wipe_and_recreate(root)
                self.stdout.write(f"  recreated storage root: {root}")

        self.stdout.write(self.style.SUCCESS(f"Demo data reset for {scope}."))

    # ------------------------------------------------------------------ #
    def _delete_run_history(self, tenant) -> None:
        from automation.models import AutomationRun
        from workflow.models import PipelineRun, PipelineStepRun

        runs = AutomationRun.all_objects.all()
        pipeline_runs = PipelineRun.all_objects.all()
        if tenant is not None:
            runs = runs.filter(tenant=tenant)
            pipeline_runs = pipeline_runs.filter(tenant=tenant)
        # Step rows cascade from PipelineRun, but delete them explicitly first
        # so a per-tenant filter cannot orphan a step whose run is filtered out.
        PipelineStepRun.all_objects.filter(run__in=pipeline_runs).hard_delete()
        runs.hard_delete()
        pipeline_runs.hard_delete()

    def _delete_stored_files(self, tenant) -> int:
        from storage.models import StoredFile
        from storage.providers import get_provider

        qs = StoredFile.all_objects.all()
        if tenant is not None:
            qs = qs.filter(tenant=tenant)

        # For a per-tenant reset the shared root is left intact, so remove each
        # object's bytes through the provider. For a full reset the root is
        # wiped wholesale below, so only the rows need clearing here.
        if tenant is not None:
            provider = get_provider()
            for key in qs.values_list("key", flat=True):
                try:
                    provider.delete(key)
                except Exception:  # noqa: BLE001 - best-effort byte cleanup
                    self.stderr.write(f"  could not delete object bytes for key {key}")
        count = qs.count()
        qs.hard_delete()
        return count

    def _delete_periods(self, tenant) -> None:
        from periods.models import BusinessPeriod, PeriodManifest

        periods = BusinessPeriod.all_objects.all()
        if tenant is not None:
            periods = periods.filter(tenant=tenant)
        PeriodManifest.all_objects.filter(period__in=periods).hard_delete()
        periods.hard_delete()

    def _local_roots(self) -> list[Path]:
        """The on-disk roots demo files land in: the platform's local object
        store and the invoice local archive (usually the same directory)."""
        roots: list[Path] = []
        for value in (
            getattr(settings, "STORAGE_LOCAL_PATH", ""),
            getattr(settings, "INVOICE_LOCAL_ARCHIVE_PATH", ""),
        ):
            if not value:
                continue
            resolved = Path(value).resolve()
            if resolved not in roots:
                roots.append(resolved)
        return roots

    def _wipe_and_recreate(self, root: Path) -> None:
        if root.exists():
            shutil.rmtree(root)
        root.mkdir(parents=True, exist_ok=True)
