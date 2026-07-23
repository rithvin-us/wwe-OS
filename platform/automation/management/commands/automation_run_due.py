"""Run every active automation rule that's due.

Pull-based, synchronous — run on a schedule by an external cron (no queue or
worker is introduced), the same shape as `contracts_expiry_scan`. Scans
every tenant, or one with --tenant. A rule that fails records a FAILED run
and is skipped for the rest of this sweep; it does not stop other rules.

    python manage.py automation_run_due
    python manage.py automation_run_due --tenant <tenant_id>
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from tenancy.models import Tenant

from automation.services import AutomationService


class Command(BaseCommand):
    help = "Run every active, due automation rule."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--tenant", default="", help="Limit to one tenant id.")

    def handle(self, *args, **options) -> None:
        service = AutomationService()
        if options["tenant"]:
            tenant = Tenant.objects.filter(id=options["tenant"]).first()
            runs = service.run_due(tenant=tenant) if tenant else []
        else:
            runs = [
                run
                for tenant in Tenant.objects.all()
                for run in service.run_due(tenant=tenant)
            ]

        succeeded = sum(1 for run in runs if run.status == "success")
        failed = len(runs) - succeeded
        message = f"Automation sweep complete: {succeeded} succeeded, {failed} failed."
        self.stdout.write(self.style.SUCCESS(message))
