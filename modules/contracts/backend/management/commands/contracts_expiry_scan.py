"""Expire past-due contracts and remind owners of upcoming renewals.

Pull-based, synchronous — run daily by a scheduler (cron / Render job). No
queue or worker is introduced. Scans every tenant, or one with --tenant.

    python manage.py contracts_expiry_scan
    python manage.py contracts_expiry_scan --tenant <tenant_id>
"""

from __future__ import annotations

from contracts.backend.services.contract import ContractService
from django.core.management.base import BaseCommand
from tenancy.models import Tenant


class Command(BaseCommand):
    help = "Expire past-due contracts and send renewal reminders."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--tenant", default="", help="Limit to one tenant id.")

    def handle(self, *args, **options) -> None:
        service = ContractService()
        tenants = (
            Tenant.objects.filter(id=options["tenant"])
            if options["tenant"]
            else Tenant.objects.all()
        )
        totals = {"expired": 0, "reminded": 0}
        for tenant in tenants:
            result = service.run_expiry_scan(tenant=tenant)
            totals["expired"] += result["expired"]
            totals["reminded"] += result["reminded"]
        self.stdout.write(
            self.style.SUCCESS(
                f"Scan complete: {totals['expired']} expired, {totals['reminded']} reminders sent."
            )
        )
