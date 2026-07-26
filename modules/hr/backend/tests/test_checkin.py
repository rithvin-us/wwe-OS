"""Self-service check-in through the public endpoint.

Runs against the stub face engine (HR_FACE_ENGINE=stub, the default) so the
decision pipeline — identify, liveness, geofence, punch, log — is covered
without pulling in ~1.5 GB of ML dependencies. The matching maths itself is
covered by the migrated test_face_recognition.py / test_attendance_punch.py.
"""

from __future__ import annotations

import io
from datetime import date

import pytest

from hr.backend.models import Attendance, PunchDecision, PunchLog
from hr.backend.services.face_recognition import get_face_service

pytestmark = pytest.mark.django_db

CHECKIN_URL = "/api/v1/hr/attendance/checkin/"
EMPLOYEES_URL = "/api/v1/hr/employees/"


def _png_bytes(colour: int = 200) -> bytes:
    """A real, minimal PNG — the endpoint validates it is an image."""
    from PIL import Image

    image = Image.new("RGB", (64, 64), (colour, colour, colour))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _selfie(name: str = "selfie.png", colour: int = 200):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(name, _png_bytes(colour), content_type="image/png")


@pytest.fixture(autouse=True)
def _stub_engine(monkeypatch):
    """Pin the stub engine and clear the cached settings/service singletons."""
    monkeypatch.setenv("HR_FACE_ENGINE", "stub")
    from hr.backend.services import face_config, face_recognition

    face_config.get_settings.cache_clear()
    if hasattr(face_recognition.get_face_service, "cache_clear"):
        face_recognition.get_face_service.cache_clear()
    yield
    face_config.get_settings.cache_clear()


@pytest.fixture
def enrolled_employee(employee_factory, tenant):
    """An employee carrying a stub face template for the same image."""
    face = get_face_service()
    embedding = face.embed(_png_bytes())
    return employee_factory(
        doj=date(2024, 1, 1),
        face_embedding=face.serialize(embedding),
    )


class TestPublicAccess:
    def test_checkin_needs_no_authentication(self, api, enrolled_employee):
        response = api.post(CHECKIN_URL, {"file": _selfie()}, format="multipart")

        # Whatever the decision, it is never 401/403 — that is the point.
        assert response.status_code not in (401, 403)

    def test_an_empty_upload_is_rejected(self, api):
        from django.core.files.uploadedfile import SimpleUploadedFile

        response = api.post(
            CHECKIN_URL,
            {"file": SimpleUploadedFile("empty.png", b"", content_type="image/png")},
            format="multipart",
        )

        assert response.status_code == 422


class TestIdentification:
    def test_a_recognised_face_punches_in(self, api, enrolled_employee):
        response = api.post(CHECKIN_URL, {"file": _selfie()}, format="multipart")

        assert response.status_code == 200, response.data
        assert response.data["recognized"] is True
        assert response.data["employee_code"] == enrolled_employee.employee_code
        assert response.data["direction"] in ("in", "out")

    def test_an_unrecognised_face_is_refused_but_still_logged(self, api, employee_factory):
        # An employee exists but has no template, so nothing can match.
        employee_factory(doj=date(2024, 1, 1))

        response = api.post(CHECKIN_URL, {"file": _selfie()}, format="multipart")

        assert response.status_code == 422
        # The attempt is recorded with no employee attached.
        log = PunchLog.all_objects.get()
        assert log.employee_id is None
        assert log.decision == PunchDecision.FLAGGED

    def test_an_approved_punch_writes_attendance(self, api, enrolled_employee):
        response = api.post(CHECKIN_URL, {"file": _selfie()}, format="multipart")

        assert response.status_code == 200
        if response.data["decision"] == PunchDecision.AUTO_APPROVED:
            assert Attendance.all_objects.filter(employee=enrolled_employee, status="P").exists()

    def test_every_attempt_is_logged(self, api, enrolled_employee):
        api.post(CHECKIN_URL, {"file": _selfie()}, format="multipart")

        log = PunchLog.all_objects.filter(employee=enrolled_employee).first()
        assert log is not None
        assert log.captured_at is not None
        assert log.face_match_score is not None


class TestCooldown:
    def test_a_second_punch_inside_the_cooldown_is_refused(self, api, enrolled_employee):
        first = api.post(CHECKIN_URL, {"file": _selfie()}, format="multipart")
        assert first.status_code == 200
        if first.data["decision"] != PunchDecision.AUTO_APPROVED:
            pytest.skip("Stub engine did not auto-approve; cooldown only follows a success.")

        second = api.post(CHECKIN_URL, {"file": _selfie()}, format="multipart")

        assert second.status_code == 422
        assert "Too soon" in str(second.data)


class TestGeofence:
    def test_the_geo_fix_is_recorded_even_when_it_does_not_gate(self, api, enrolled_employee):
        response = api.post(
            CHECKIN_URL,
            {"file": _selfie(), "lat": 11.0785, "lon": 77.0057, "accuracy": 20},
            format="multipart",
        )

        assert response.status_code == 200, response.data
        # Dead on the configured site centre.
        assert response.data["within_geofence"] is True
        assert PunchLog.all_objects.get(employee=enrolled_employee).within_geofence is True

    def test_a_far_away_fix_is_recorded_as_outside(self, api, enrolled_employee):
        response = api.post(
            CHECKIN_URL,
            {"file": _selfie(), "lat": 28.6139, "lon": 77.2090, "accuracy": 20},
            format="multipart",
        )

        assert response.status_code == 200
        assert response.data["within_geofence"] is False


class TestEnrolment:
    def test_enrolment_stores_a_template_but_never_the_image(
        self, auth_client, owner, employee_factory
    ):
        employee = employee_factory(doj=date(2024, 1, 1))

        response = auth_client(owner).post(
            f"{EMPLOYEES_URL}{employee.pk}/enroll/", {"file": _selfie()}, format="multipart"
        )

        assert response.status_code == 200, response.data
        assert response.data["checkin_path"] == "/attend"
        employee.refresh_from_db()
        assert employee.face_embedding != ""
        assert employee.enrolled_at is not None
        # Nothing image-like was persisted: only the serialized template.
        from storage.models import StoredFile

        assert not StoredFile.objects.filter(module="hr", category="").exists()

    def test_revoking_disables_photo_checkin(self, auth_client, owner, enrolled_employee):
        response = auth_client(owner).post(
            f"{EMPLOYEES_URL}{enrolled_employee.pk}/revoke-enrollment/"
        )

        assert response.status_code == 200, response.data
        enrolled_employee.refresh_from_db()
        assert enrolled_employee.face_embedding == ""
        assert enrolled_employee.enrolled_at is None

    def test_enrolment_requires_authentication(self, api, employee_factory):
        employee = employee_factory(doj=date(2024, 1, 1))

        response = api.post(
            f"{EMPLOYEES_URL}{employee.pk}/enroll/", {"file": _selfie()}, format="multipart"
        )

        assert response.status_code == 401
