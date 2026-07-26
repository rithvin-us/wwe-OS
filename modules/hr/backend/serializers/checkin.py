"""Self-service check-in shaping."""

from __future__ import annotations

from rest_framework import serializers


class CheckInRequestSerializer(serializers.Serializer):
    """Multipart body posted by the standalone check-in page."""

    file = serializers.ImageField(help_text="Live-captured selfie")
    frames = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        help_text="Optional liveness burst: extra frames ~400 ms apart",
    )
    lat = serializers.FloatField(required=False, allow_null=True)
    lon = serializers.FloatField(required=False, allow_null=True)
    accuracy = serializers.FloatField(required=False, allow_null=True)
    # Which company the check-in belongs to. Optional in single-operator
    # deployments — see CheckInView for how the tenant is resolved.
    tenant = serializers.CharField(required=False, allow_blank=True)


class CheckInResponseSerializer(serializers.Serializer):
    """Result of a check-in. The employee is identified 1:N from the captured
    face, so `employee_name`/`employee_code` echo who was recognised."""

    recognized = serializers.BooleanField()
    employee_id = serializers.UUIDField(allow_null=True)
    employee_name = serializers.CharField(allow_null=True)
    employee_code = serializers.CharField(allow_null=True)
    decision = serializers.CharField(help_text="auto_approved | flagged")
    direction = serializers.CharField(help_text="in | out")
    shift = serializers.CharField()
    time = serializers.CharField(help_text="Recorded time HH:MM")
    within_geofence = serializers.BooleanField()
    face_score = serializers.FloatField(help_text="Cosine similarity of the best match [-1, 1]")
    confidence = serializers.FloatField(help_text="Match confidence percentage 0-100")
    message = serializers.CharField()


class EnrollFaceSerializer(serializers.Serializer):
    file = serializers.ImageField(help_text="Reference face photo")


class EnrollResponseSerializer(serializers.Serializer):
    employee_id = serializers.UUIDField()
    employee_name = serializers.CharField()
    employee_code = serializers.CharField()
    enrolled_at = serializers.DateTimeField()
    checkin_path = serializers.CharField()
