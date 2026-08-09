from __future__ import annotations

from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.exceptions import ValidationError
from shared.permissions import HasPlatformPermission
from shared.views import ReadOnlyModelViewSet
from storage.services import StorageService

from audit.models import AuditLog
from audit.serializers import AuditLogSerializer
from audit.services import AuditService

VOICE_NOTE_ALLOWED_TYPES = {"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"}


class AuditLogViewSet(ReadOnlyModelViewSet):
    """Read-only audit trail. Archive is the only mutation permitted."""

    serializer_class = AuditLogSerializer
    permission_classes = ReadOnlyModelViewSet.permission_classes + [HasPlatformPermission]
    required_permissions = {
        "list": "audit.view",
        "retrieve": "audit.view",
        "archive": "audit.archive",
    }
    search_fields = ("action", "module", "object_type", "object_id")
    ordering_fields = ("created_at", "action", "module")
    filterset_fields = {
        "module": ["exact", "in"],
        "action": ["exact"],
        "archived": ["exact"],
        "actor": ["exact"],
        # Cross-reference: every entry for one record, e.g. all activity on
        # a single purchase bill (object_type=PurchaseBill&object_id=<id>).
        "object_type": ["exact"],
        "object_id": ["exact"],
        "created_at": ["gte", "lte"],
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AuditLog.objects.none()
        user = self.request.user
        qs = AuditLog.objects.all()
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    @action(detail=True, methods=["post"])
    def archive(self, request: Request, pk=None) -> Response:
        entry = self.get_object()
        entry.archive()
        return Response({"detail": "Audit record archived."})


class VoiceNoteView(APIView):
    """Log a spoken quick-note to the Business Timeline.

    Stores the clip via the storage capability, then writes a plain audit
    entry describing it — the same feed /timeline and the dashboard's
    "Recent activity" already read, so a voice note shows up there like any
    other business event with no separate surface to build.
    """

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "audit.write"
    parser_classes = [MultiPartParser]

    def post(self, request: Request) -> Response:
        audio = request.FILES.get("audio")
        if not audio:
            raise ValidationError(detail={"audio": ["An audio file is required."]})

        stored = StorageService().store(
            data=audio.read(),
            filename=audio.name or "voice-note.webm",
            content_type=audio.content_type or "audio/webm",
            module="audit",
            category="voice-note",
            uploaded_by=request.user,
            allowed_types=VOICE_NOTE_ALLOWED_TYPES,
        )
        audio_url = StorageService().signed_url(stored, expires_seconds=3600)

        duration_ms = int(request.data.get("duration_ms") or 0)
        minutes, seconds = divmod(duration_ms // 1000, 60)

        entry = AuditService().record(
            action="note.voice_logged",
            module="notes",
            object_type="VoiceNote",
            object_id=str(stored.id),
            changes={
                "title": f"Voice note ({minutes}:{seconds:02d})",
                "audio_key": stored.key,
                "duration_ms": duration_ms,
            },
            actor=request.user,
        )
        return Response({**AuditLogSerializer(entry).data, "audio_url": audio_url}, status=201)
