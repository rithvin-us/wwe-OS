"""Face enrolment.

Migrated from the legacy app's enrol endpoint. The operator uploads one
reference photo; it becomes a face template (embedding) stored on the employee —
the "master knowledge" that self-service check-in matches against 1:N.

Only the embedding is kept. **The raw reference image is never persisted** — that
was true in the legacy app and stays true here: it is biometric data, and not
storing it is the strongest protection available.

Enrolment applies the strict quality gates (`enroll=True`): blurry,
side-profile, multiple-face and too-small captures are rejected with a reason,
because a bad template poisons every later match.
"""

from __future__ import annotations

import logging

from audit.services import AuditService
from django.utils import timezone
from shared.exceptions import ValidationError

from hr.backend.models import Employee
from hr.backend.services.face_recognition import FaceError, get_face_service

logger = logging.getLogger(__name__)

MODULE = "hr"


class EnrollmentService:
    def __init__(self) -> None:
        self.audit = AuditService()

    def enroll(self, *, employee: Employee, image_bytes: bytes) -> Employee:
        if not image_bytes:
            raise ValidationError(detail={"file": ["Empty image upload."]})

        face = get_face_service()
        try:
            embedding = face.embed(image_bytes, enroll=True)
        except FaceError as exc:
            logger.info("enrol rejected for employee %s: %s", employee.employee_code, exc.message)
            raise ValidationError(detail={"file": [exc.message]}) from exc

        employee.face_embedding = face.serialize(embedding)
        employee.enrolled_at = timezone.now()
        employee.save(update_fields=["face_embedding", "enrolled_at", "updated_at"])

        logger.info(
            "enrolled face template for employee %s (dim=%d)",
            employee.employee_code,
            len(embedding),
        )
        self.audit.record(
            action="hr.employee.face_enrolled",
            module=MODULE,
            object_type="Employee",
            object_id=str(employee.pk),
            # No embedding or image data in the audit trail — only the fact.
            changes={"employee_code": employee.employee_code},
        )
        return employee

    def revoke(self, *, employee: Employee) -> Employee:
        """Remove an employee's face template, disabling photo check-in for them."""
        employee.face_embedding = ""
        employee.enrolled_at = None
        employee.save(update_fields=["face_embedding", "enrolled_at", "updated_at"])

        self.audit.record(
            action="hr.employee.face_revoked",
            module=MODULE,
            object_type="Employee",
            object_id=str(employee.pk),
            changes={"employee_code": employee.employee_code},
        )
        return employee
