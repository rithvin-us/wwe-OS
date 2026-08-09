"""Self-service check-in — face identification, liveness, geofence, punch.

Migrated from the legacy app's public `/api/attendance/checkin` endpoint. The
decision sequence is preserved exactly, including the order of the gates and
which failures write an attendance row versus only a log row.

SECURITY NOTE (carried over from the legacy code, and still true): 1:N face
identification is weaker than the 1:1 device binding it replaced — it
authenticates by face alone. Liveness, the site geofence and a match margin are
the only additional gates. Tune HR_FACE_MATCH_THRESHOLD /
HR_FACE_IDENTIFY_MARGIN and run HR_FACE_ENGINE=insightface (or =http against
services/face-ai) before relying on this in production. A failed liveness check
never auto-approves.

Every attempt is logged to PunchLog even when no attendance row is written, so a
run of failures is visible.
"""

from __future__ import annotations

import datetime as dt
import logging
from zoneinfo import ZoneInfo

from django.db import transaction
from shared.exceptions import ValidationError

from hr.backend.models import PunchDecision, PunchLog
from hr.backend.repositories import AttendanceRepository, EmployeeRepository
from hr.backend.services.attendance_punch import (
    AUTO_APPROVED,
    FLAGGED,
    decide_punch,
    determine_punch_intent,
    identify_employee,
    next_swipe_times,
)
from hr.backend.services.face_config import get_settings
from hr.backend.services.face_recognition import FaceError, get_face_service, to_confidence
from hr.backend.services.geofence import within_site
from hr.backend.services.shift_rules import SHIFT_DEFINITIONS, normalize_shift, validate_swipe

logger = logging.getLogger(__name__)

# The server clock is authoritative — a client-supplied timestamp is ignored.
# Punches are recorded in IST because the shift windows are defined in local time.
PUNCH_TIMEZONE = ZoneInfo("Asia/Kolkata")

# Cap the liveness burst so a hostile client cannot post unbounded images.
MAX_LIVENESS_FRAMES = 4


class FaceNotRecognised(ValidationError):
    """No enrolled template matched the captured face."""


class PunchTooSoon(ValidationError):
    """A successful punch happened inside the cooldown window."""


class CheckInService:
    def __init__(self, tenant) -> None:
        self.tenant = tenant
        self.employees = EmployeeRepository()
        self.attendance = AttendanceRepository()

    def check_in(
        self,
        *,
        image_bytes: bytes,
        extra_frames: list[bytes] | None = None,
        lat: float | None = None,
        lon: float | None = None,
        accuracy: float | None = None,
    ) -> dict:
        """Identify, decide, punch, log.

        Deliberately NOT wrapped in a single transaction. An unrecognised face
        writes a PunchLog row and then raises — inside one atomic block the
        raise would roll that row straight back, losing exactly the evidence
        this log exists to keep. Only the punch itself needs atomicity, and it
        gets its own block below.
        """
        settings = get_settings()

        if not image_bytes:
            raise ValidationError(detail={"file": ["Empty image upload."]})
        frames = [f for f in (extra_frames or [])[:MAX_LIVENESS_FRAMES] if f]

        # The actual geofence result is recorded regardless of whether it gates
        # the decision, so an off-site pattern is still visible in the log.
        within = bool(
            lat is not None
            and lon is not None
            and within_site(
                lat, lon, settings.SITE_LAT, settings.SITE_LON, settings.SITE_RADIUS_M, accuracy
            )
        )
        geofence_ok = within if settings.GEOFENCE_ENABLED else True

        face = get_face_service()
        # Liveness and embedding both need a detectable face. A face-quality
        # failure carries its own message rather than surfacing as a 500.
        try:
            liveness_ok = face.verify_liveness(image_bytes, frames)
            probe = face.embed(image_bytes)
        except FaceError as exc:
            raise ValidationError(detail={"file": [exc.message]}) from exc

        candidates = list(self.employees.enrolled_employees())
        candidate_embeddings = [(emp, face.deserialize(emp.face_embedding)) for emp in candidates]
        scored_pairs = [
            (emp, face.compare(probe, emb)) for emp, emb in candidate_embeddings if emb is not None
        ]
        scored_pairs.sort(key=lambda pair: pair[1], reverse=True)
        top_scores_summary = [f"{emp.employee_code}:{score:.3f}" for emp, score in scored_pairs[:3]]
        logger.info(
            "checkin face match eval: candidates=%d valid=%d top=%s req=%.2f",
            len(candidates),
            len(scored_pairs),
            top_scores_summary,
            settings.FACE_MATCH_THRESHOLD,
        )

        match = identify_employee(
            probe,
            candidate_embeddings,
            face.compare,
            settings.FACE_MATCH_THRESHOLD,
            settings.FACE_IDENTIFY_MARGIN,
        )

        now = dt.datetime.now(PUNCH_TIMEZONE)

        if match is None:
            req_thresh = settings.FACE_MATCH_THRESHOLD
            best_score_msg = (
                f" (best: {scored_pairs[0][1]:.2f}, req: {req_thresh:.2f})"
                if scored_pairs
                else " (no enrolled employee templates found in DB)"
            )
            # Log the attempt with no employee, then tell them to get enrolled.
            PunchLog.objects.create(
                tenant=self.tenant,
                employee=None,
                captured_at=now,
                latitude=lat,
                longitude=lon,
                geo_accuracy_m=accuracy,
                within_geofence=within,
                face_match_score=scored_pairs[0][1] if scored_pairs else None,
                direction="",
                decision=PunchDecision.FLAGGED,
            )
            raise FaceNotRecognised(
                detail={"face": [f"Face not recognized{best_score_msg}. Stand facing camera."]}
            )

        employee, score = match
        # No raw image is ever logged — only the resulting confidence.
        logger.info(
            "checkin identified employee=%s score=%.3f confidence=%.1f%% liveness=%s geofence=%s",
            employee.employee_code,
            score,
            to_confidence(score),
            liveness_ok,
            within,
        )

        # Spam guard: only a *successful* punch starts the cooldown, so someone
        # flagged for being off-site can retry immediately once in range.
        recent = (
            PunchLog.objects.filter(employee=employee, decision=PunchDecision.AUTO_APPROVED)
            .order_by("-captured_at")
            .first()
        )
        if (
            recent is not None
            and (now - recent.captured_at).total_seconds() < settings.PUNCH_COOLDOWN_MINUTES * 60
        ):
            raise PunchTooSoon(detail={"checkin": ["Too soon since last check-in — please wait."]})

        decision = decide_punch(score, geofence_ok, settings.FACE_MATCH_THRESHOLD)
        # A failed anti-spoofing check never auto-approves.
        if not liveness_ok:
            decision = FLAGGED

        now_hhmm = now.strftime("%H:%M")
        open_record = self._find_open_record(employee, now)
        shift, direction = determine_punch_intent(
            now_hhmm,
            normalize_shift(employee.shift),
            open_record.shift if open_record else None,
        )

        # The attendance row and its log entry land together or not at all.
        with transaction.atomic():
            if decision == AUTO_APPROVED:
                self._write_attendance(
                    employee=employee,
                    now=now,
                    now_hhmm=now_hhmm,
                    shift=shift,
                    direction=direction,
                    open_record=open_record,
                )

            PunchLog.objects.create(
                tenant=self.tenant,
                employee=employee,
                captured_at=now,
                latitude=lat,
                longitude=lon,
                geo_accuracy_m=accuracy,
                within_geofence=within,
                face_match_score=score,
                direction=direction,
                decision=decision,
            )

        return {
            "recognized": True,
            "employee_id": employee.pk,
            "employee_name": employee.employee_name,
            "employee_code": employee.employee_code,
            "decision": decision,
            "direction": direction,
            "shift": shift,
            "time": now_hhmm,
            "within_geofence": within,
            "face_score": round(score, 3),
            "confidence": to_confidence(score),
            "message": self._message(
                employee=employee,
                decision=decision,
                direction=direction,
                shift=shift,
                now_hhmm=now_hhmm,
                liveness_ok=liveness_ok,
                score=score,
                within=within,
                settings=settings,
            ),
        }

    # ----------------------------------------------------------------- helpers

    def _find_open_record(self, employee, now: dt.datetime):
        """The most recent punched-in-but-not-out row from today or yesterday.

        Yesterday matters: a night shift starting 22:00 is closed the next
        morning, so the row being completed belongs to the previous day.
        """
        yesterday = now - dt.timedelta(days=1)
        rows = list(self.attendance.month_for_employee(employee.pk, now.year, now.month))
        if now.day == 1:
            prev = now.replace(day=1) - dt.timedelta(days=1)
            previous = list(self.attendance.month_for_employee(employee.pk, prev.year, prev.month))
            rows = previous + rows

        for row in reversed(rows):
            if row.in_time and not row.out_time:
                is_today = (row.year, row.month, row.day) == (now.year, now.month, now.day)
                was_yesterday = (row.year, row.month, row.day) == (
                    yesterday.year,
                    yesterday.month,
                    yesterday.day,
                )
                if is_today or was_yesterday:
                    return row
        return None

    def _write_attendance(self, *, employee, now, now_hhmm, shift, direction, open_record) -> None:
        if direction == "out" and open_record and open_record.shift == shift:
            # Closing an open record, possibly yesterday's (night shift).
            target = (open_record.year, open_record.month, open_record.day)
            existing_in, existing_out = open_record.in_time, open_record.out_time
        else:
            target = (now.year, now.month, now.day)
            today = self.attendance.get_or_none(
                employee_id=employee.pk, year=target[0], month=target[1], day=target[2]
            )
            existing_in = today.in_time if today else ""
            existing_out = today.out_time if today else ""

        in_time, out_time = next_swipe_times(direction, existing_in, existing_out, now_hhmm)
        check = validate_swipe(shift, in_time, out_time)
        has_both = bool(in_time and out_time)

        self.attendance.upsert_day(
            employee_id=employee.pk,
            tenant_id=self.tenant.id,
            year=target[0],
            month=target[1],
            day=target[2],
            status="P",
            in_time=in_time or "",
            out_time=out_time or "",
            shift=shift,
            worked_hours=check.worked_hours if has_both else None,
            ot_hours=check.ot_hours if has_both else None,
        )

    @staticmethod
    def _message(
        *, employee, decision, direction, shift, now_hhmm, liveness_ok, score, within, settings
    ) -> str:
        if decision == AUTO_APPROVED:
            return (
                f"{employee.employee_name} checked {direction} at {now_hhmm} — "
                f"{SHIFT_DEFINITIONS[shift].name} shift"
            )

        reasons = []
        if not liveness_ok:
            reasons.append("anti-spoofing check failed (suspicious presentation attack)")
        if score < settings.FACE_MATCH_THRESHOLD:
            reasons.append("face not confidently matched")
        if settings.GEOFENCE_ENABLED and not within:
            reasons.append("outside the site location")
        return "Check-in flagged for review: " + ", ".join(reasons or ["verification failed"])
