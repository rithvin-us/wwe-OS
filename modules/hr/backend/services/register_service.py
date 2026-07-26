"""Statutory register generation — the orchestration around the copied generator.

Migrated from the legacy app's excel API + archive service. The sequence is
preserved exactly, because each step is a compliance requirement:

1. Load the month's employees, attendance and payroll.
2. Build the workbook from a **copy** of the immutable company template.
3. Archive it with a SHA-256 fingerprint under the next version number for that
   month — regenerating never overwrites an earlier submission.
4. Write an immutable GenerationLog row.
5. **Lock the period**, so the figures behind a submitted register cannot
   silently change afterwards.
6. Record the event in the audit trail.

What changed: the legacy `ArchiveService` (a local `archive/` directory plus its
own hashing) is gone. `platform/storage` already stores bytes durably, computes
the SHA-256 on write and verifies integrity on demand, and
`periods.record_document` tracks the month's manifest — so the module uses those
instead of keeping a second copy of that machinery.
"""

from __future__ import annotations

import gc
import logging
from datetime import datetime

from audit.services import AuditService
from django.db import transaction
from django.db.models import Max
from periods.services import PeriodService
from shared import context
from shared.exceptions import NotFoundError, ValidationError
from storage.services import StorageService

from hr.backend.models import GenerationLog, GenerationStatus
from hr.backend.repositories import (
    AttendanceRepository,
    EmployeeRepository,
    PayrollRepository,
)
from hr.backend.services.registers import ExcelGenerator
from hr.backend.services.registers.config import get_settings

logger = logging.getLogger(__name__)

MODULE = "hr"
REGISTER_CATEGORY = "statutory_register"
XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class RegisterService:
    def __init__(self) -> None:
        self.employees = EmployeeRepository()
        self.attendance = AttendanceRepository()
        self.payroll = PayrollRepository()
        self.storage = StorageService()
        self.periods = PeriodService()
        self.audit = AuditService()

    def history(self, year: int | None = None, month: int | None = None):
        qs = GenerationLog.objects.select_related("stored_file", "generated_by")
        if year is not None:
            qs = qs.filter(year=year)
        if month is not None:
            qs = qs.filter(month=month)
        return qs

    @transaction.atomic
    def generate(self, *, year: int, month: int, actor=None) -> GenerationLog:
        """Produce the month's statutory workbook and lock the month."""
        tenant = context.current_tenant()
        actor = actor or context.current_user()

        payroll_records = list(self.payroll.by_month(year, month))
        if not payroll_records:
            raise ValidationError(
                detail={
                    "payroll": [
                        f"Run payroll for {year}-{month:02d} before generating its registers."
                    ]
                }
            )

        # The generator takes pre-loaded model instances and touches no database
        # itself — see hr.backend.services.registers.
        payload_data = {
            "year": year,
            "month": month,
            "employees": list(self.employees.employees_for_month(year, month)),
            "attendance": list(self.attendance.month_all_employees(year, month)),
            "payroll": payroll_records,
        }

        generator = ExcelGenerator()
        work_filename = generator.generate(year, month, payload_data)
        del payload_data, generator  # free the workbook and rows early
        gc.collect()

        work_path = get_settings().generated_full_path / work_filename
        try:
            data = work_path.read_bytes()
        finally:
            # The working copy is scratch; platform/storage owns the durable one.
            work_path.unlink(missing_ok=True)

        next_version = (
            GenerationLog.objects.filter(year=year, month=month).aggregate(highest=Max("version"))[
                "highest"
            ]
            or 0
        ) + 1

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archived_filename = f"HR_Compliance_{year}-{month:02d}_v{next_version}_{timestamp}.xlsx"

        stored = self.storage.store(
            data=data,
            filename=archived_filename,
            content_type=XLSX_CONTENT_TYPE,
            module=MODULE,
            tenant=tenant,
            uploaded_by=actor if getattr(actor, "pk", None) else None,
            category=REGISTER_CATEGORY,
            period_year=year,
            period_month=month,
            metadata={"year": year, "month": month, "version": next_version},
        )

        log = GenerationLog.objects.create(
            tenant=tenant,
            year=year,
            month=month,
            version=next_version,
            filename=archived_filename,
            file_hash=stored.sha256,
            stored_file=stored,
            status=GenerationStatus.GENERATED,
            generated_by=actor if getattr(actor, "pk", None) else None,
        )

        period = self.periods.get_or_create_period(tenant=tenant, year=year, month=month)
        self.periods.refresh_manifest(period=period)
        # Submitted figures are frozen from here. Unlocking demands a reason.
        self.periods.lock(tenant=tenant, year=year, month=month, actor=actor)

        self.audit.record(
            action="hr.register.generated",
            module=MODULE,
            object_type="GenerationLog",
            object_id=str(log.pk),
            changes={
                "period": f"{year}-{month:02d}",
                "version": next_version,
                "filename": archived_filename,
                "sha256": stored.sha256,
            },
        )
        logger.info(
            "Generated statutory registers %s-%02d v%d (%s)",
            year,
            month,
            next_version,
            stored.sha256[:16],
        )
        return log

    def download(self, log: GenerationLog) -> tuple[bytes, str]:
        """Re-download a previously generated workbook."""
        if log.stored_file is None:
            raise NotFoundError("The stored file for this generation is no longer available.")
        return self.storage.open(log.stored_file), log.filename

    def verify(self, log: GenerationLog) -> dict:
        """Confirm an archived workbook has not been altered since generation.

        Checks the bytes against the digest recorded on the log row, not just
        against the StoredFile's own digest — otherwise a rewrite of both would
        pass.
        """
        if log.stored_file is None:
            raise NotFoundError("The stored file for this generation is no longer available.")

        import hashlib

        actual = hashlib.sha256(self.storage.open(log.stored_file)).hexdigest()
        valid = actual == log.file_hash
        if not valid:
            logger.error(
                "Integrity check FAILED for %s: expected %s..., got %s...",
                log.filename,
                log.file_hash[:16],
                actual[:16],
            )
        return {
            "valid": valid,
            "filename": log.filename,
            "expected_hash": log.file_hash,
            "actual_hash": actual,
        }
