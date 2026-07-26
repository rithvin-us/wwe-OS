"""PayRulesConfig — global statutory rates, effective-dated.

Migrated from the legacy app's `PayRulesConfig`. Statutory rates change over
time; keeping a dated history means any past month can be recalculated with
the rates that were actually in force then.

This is NOT per-employee — per-employee wage components live in `SalaryRule`.

Why this is a module model and not `platform/rules`: the platform rules engine
evaluates facts and returns an outcome (approve / needs attention). This is
dated statutory *configuration* — PF percentages, ESI ceilings, LWF — which is
Indian-payroll domain meaning, so it belongs to the module.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class PayRulesConfig(TenantOwnedModel):
    # The currently-active row has effective_to = None.
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)

    # Working-time standards
    standard_days_per_month = models.PositiveSmallIntegerField(default=26)
    standard_hours_per_day = models.PositiveSmallIntegerField(default=8)

    # Overtime
    ot_multiplier = models.FloatField(default=2.0)

    # Provident Fund
    pf_employee_percent = models.FloatField(default=12.0)
    pf_employer_percent = models.FloatField(default=13.0)
    pf_cap = models.FloatField(default=1800.0)

    # Employee State Insurance
    esi_employee_percent = models.FloatField(default=0.75)
    esi_employer_percent = models.FloatField(default=3.25)
    esi_wage_ceiling = models.FloatField(default=21000.0)
    esi_cap = models.FloatField(default=158.0)

    # Professional Tax slabs:
    # [{"min": 0, "max": 21000, "amount": 0}, {"min": 21001, ...}, ...]
    # Legacy stored this as a JSON string in a Text column; a real JSONField is
    # the platform convention and nothing reads it yet (the engine's PT branch
    # is still a stub), so the shape moves across without a behaviour change.
    pt_slabs = models.JSONField(default=list, blank=True)

    # Labour Welfare Fund
    lwf_employee = models.FloatField(default=0.0)
    lwf_employer = models.FloatField(default=0.0)

    description = models.CharField(max_length=200, blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_pay_rules_config"
        indexes = [models.Index(fields=["tenant", "effective_from"])]

    def __str__(self) -> str:
        return f"PayRules({self.effective_from} → {self.effective_to or 'current'})"
