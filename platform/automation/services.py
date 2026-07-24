"""Automation engine — resolves a rule's tagged records, builds its
destination artifact, and records exactly what happened.

Runs are synchronous and pull-based, the same shape as
`contracts.backend.services.contract.ContractService.run_expiry_scan`: no
queue, driven by a management command an external cron calls. A rule never
sends anything off-platform — `email`/`cloud_storage` destinations are
rejected until a real delivery mechanism exists (see `STUB_DESTINATIONS`);
`downloaded_package` and `auditor_folder` only ever produce a signed-URL
download the operator retrieves and hands off themselves.
"""

from __future__ import annotations

import io
import zipfile
from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone
from django.utils.text import slugify
from shared.events import publish
from shared.exceptions import ConflictError, ValidationError
from shared.services import BaseService

from automation.models import (
    FILE_DESTINATIONS,
    STUB_DESTINATIONS,
    AutomationRule,
    AutomationRun,
    Cadence,
    Destination,
    RunStatus,
    TriggerType,
)
from automation.registry import CollectedFile, get_source

MAX_TAGS = 20


def _advance(cadence: str, from_dt: datetime) -> datetime | None:
    if cadence == Cadence.DAILY:
        return from_dt + timedelta(days=1)
    if cadence == Cadence.WEEKLY:
        return from_dt + timedelta(weeks=1)
    if cadence == Cadence.MONTHLY:
        # Calendar month, not a 30-day approximation; clamps to the last
        # valid day (e.g. Jan 31 -> Feb 28) rather than overflowing.
        month = from_dt.month % 12 + 1
        year = from_dt.year + (from_dt.month // 12)
        import calendar

        day = min(from_dt.day, calendar.monthrange(year, month)[1])
        return from_dt.replace(year=year, month=month, day=day)
    return None  # ONCE — no next run


def _build_zip(files: list[tuple[str, CollectedFile]]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for arcname, file in files:
            archive.writestr(arcname, file.data)
    return buffer.getvalue()


class AutomationService(BaseService):
    # ------------------------------------------------------------------ #
    # Rule authoring
    # ------------------------------------------------------------------ #
    def validate_rule(self, *, data: dict[str, Any]) -> None:
        required_tags = data.get("required_tags") or []
        if not required_tags:
            raise ValidationError(
                detail={
                    "required_tags": [
                        "At least one tag is required — a rule never collects everything untagged."
                    ]
                }
            )
        if len(required_tags) > MAX_TAGS:
            raise ValidationError(detail={"required_tags": [f"At most {MAX_TAGS} tags."]})

        destination = data.get("destination")
        if destination == Destination.GENERATE_REPORT and not data.get("report_key"):
            raise ValidationError(
                detail={"report_key": ["A report is required for this destination."]}
            )
        if destination in FILE_DESTINATIONS and not data.get("source_modules"):
            raise ValidationError(
                detail={"source_modules": ["At least one source module is required."]}
            )
        for module in data.get("source_modules") or []:
            get_source(module)  # unregistered module = wiring bug or bad input, fail loudly

    # ------------------------------------------------------------------ #
    # Execution
    # ------------------------------------------------------------------ #
    def run_rule(
        self, *, rule: AutomationRule, actor=None, triggered_by: str = TriggerType.SCHEDULE
    ) -> AutomationRun:
        if rule.destination in STUB_DESTINATIONS:
            raise ConflictError(
                f"{rule.get_destination_display()} isn't available yet — this rule can be "
                "saved, but not run."
            )

        started = timezone.now()
        items: list[dict[str, Any]] = []
        output_file = None
        report_export = None
        error = ""
        status = RunStatus.SUCCESS

        try:
            if rule.destination == Destination.GENERATE_REPORT:
                from reporting.services import ReportService

                report_export = ReportService().run(
                    key=rule.report_key,
                    format=rule.export_format or "csv",
                    filters={"tag_ids": rule.required_tags},
                    tenant=rule.tenant,
                    actor=actor,
                )
                items = [
                    {
                        "module": "reporting",
                        "object_type": "ReportExport",
                        "object_id": str(report_export.id),
                        "title": report_export.title,
                        "included": True,
                    }
                ]
            else:
                items, output_file = self._collect_and_package(
                    rule=rule, started=started, actor=actor
                )
        except Exception as exc:  # recorded on the run below, never re-raised — one bad rule
            status = RunStatus.FAILED  # must not stop the rest of a scheduled sweep.
            error = str(exc)

        finished = timezone.now()
        run = self._record_run(
            rule=rule,
            status=status,
            triggered_by=triggered_by,
            started=started,
            finished=finished,
            items=items,
            output_file=output_file,
            report_export=report_export,
            error=error,
            actor=actor,
        )
        self._advance_schedule(rule=rule, finished=finished)
        return run

    def _collect_and_package(
        self, *, rule: AutomationRule, started, actor
    ) -> tuple[list[dict[str, Any]], Any]:
        items: list[dict[str, Any]] = []
        collected: list[tuple[str, CollectedFile]] = []

        for module in rule.source_modules:
            adapter = get_source(module)
            for ref in adapter.list_tagged(rule.tenant, rule.required_tags):
                file = adapter.collect_file(ref["object_id"])
                included = file is not None
                items.append(
                    {
                        "module": module,
                        "object_type": adapter.object_type,
                        "object_id": ref["object_id"],
                        "title": ref["title"],
                        "included": included,
                    }
                )
                if included:
                    arcname = f"{module}/{ref['object_id']}-{file.filename}"
                    collected.append((arcname, file))

        if not collected:
            raise ConflictError("No files matched the required tags — nothing to package.")

        zip_bytes = _build_zip(collected)
        is_auditor = rule.destination == Destination.AUDITOR_FOLDER
        category = "auditor-folder" if is_auditor else "automation-package"
        from storage.services import StorageService

        output_file = StorageService().store(
            data=zip_bytes,
            filename=f"{slugify(rule.name) or 'automation'}-{started:%Y%m%d-%H%M%S}.zip",
            content_type="application/zip",
            module="automation",
            category=category,
            tenant=rule.tenant,
            uploaded_by=actor,
            metadata={"rule_id": str(rule.id), "item_count": len(collected)},
            # System-generated, not a user upload — allow the one content
            # type this path ever produces, without widening the platform's
            # general upload allowlist for it.
            allowed_types={"application/zip"},
        )
        return items, output_file

    def _record_run(
        self,
        *,
        rule: AutomationRule,
        status: str,
        triggered_by: str,
        started,
        finished,
        items: list[dict[str, Any]],
        output_file,
        report_export,
        error: str,
        actor,
        pipeline_run=None,
    ) -> AutomationRun:
        run = AutomationRun.objects.create(
            tenant=rule.tenant,
            rule=rule,
            rule_name=rule.name,
            destination=rule.destination,
            status=status,
            triggered_by=triggered_by,
            started_at=started,
            finished_at=finished,
            item_count=len(items),
            items=items,
            output_file=output_file,
            report_export=report_export,
            error_message=error,
            actor=actor,
            pipeline_run=pipeline_run,
        )
        from audit.services import AuditService

        AuditService().record(
            action="automation.rule_executed",
            module="automation",
            object_type="AutomationRule",
            object_id=str(rule.id),
            changes={
                "rule_name": rule.name,
                "destination": rule.destination,
                "status": status,
                "item_count": len(items),
                "items": items[:50],
            },
            actor=actor,
            tenant=rule.tenant,
        )
        publish("automation.rule_executed", instance=run, actor=actor)
        return run

    def _advance_schedule(self, *, rule: AutomationRule, finished) -> None:
        rule.last_run_at = finished
        rule.next_run_at = _advance(rule.cadence, finished)
        if rule.cadence == Cadence.ONCE:
            rule.is_active = False
        rule.save(update_fields=["last_run_at", "next_run_at", "is_active", "updated_at"])

    # ------------------------------------------------------------------ #
    # Scheduling
    # ------------------------------------------------------------------ #
    def run_due(self, *, tenant=None) -> list[AutomationRun]:
        """Runs every active, due rule (used by the `automation_run_due`
        management command). A rule scoped to a stub destination is skipped,
        not failed — it hasn't missed a run, it just can't fire yet."""
        qs = AutomationRule.objects.filter(is_active=True, next_run_at__lte=timezone.now())
        if tenant is not None:
            qs = qs.filter(tenant=tenant)
        return [
            self.run_rule(rule=rule, triggered_by=TriggerType.SCHEDULE)
            for rule in qs.exclude(destination__in=STUB_DESTINATIONS)
        ]
