"""Check every active alert rule that's due and send whatever fires.

Pull-based, synchronous — run on a schedule by an external cron (no queue or
worker), the same shape as `automation_run_due`. Scans every tenant, or one
with --tenant. A rule that errors is skipped for the rest of this sweep; it
does not stop other rules.

    python manage.py alerts_check_due
    python manage.py alerts_check_due --tenant <tenant_id>
"""

from __future__ import annotations

import logging

from django.core.management.base import BaseCommand
from tenancy.models import Tenant

from alerts.services import AlertService

logger = logging.getLogger("platform.alerts")


class Command(BaseCommand):
    help = "Check every active, due alert rule and send whatever fires."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--tenant", default="", help="Limit to one tenant id.")

    def handle(self, *args, **options) -> None:
        service = AlertService()
        if options["tenant"]:
            tenants = Tenant.objects.filter(id=options["tenant"])
        else:
            tenants = Tenant.objects.all()

        total_fired = 0
        for tenant in tenants:
            try:
                total_fired += service.run_due(tenant=tenant)
            except Exception:
                logger.exception("Alert sweep failed for tenant %s.", tenant.id)

        self.stdout.write(self.style.SUCCESS(f"Alert sweep complete: {total_fired} fired."))
