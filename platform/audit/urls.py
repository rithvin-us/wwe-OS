from django.urls import path
from rest_framework.routers import DefaultRouter

from audit.views import AuditLogViewSet, VoiceNoteView

router = DefaultRouter()
router.register("", AuditLogViewSet, basename="audit")

# Must precede router.urls — the router's retrieve pattern
# (^(?P<pk>[^/.]+)/$) would otherwise swallow this literal path first.
urlpatterns = [
    path("voice-notes/", VoiceNoteView.as_view(), name="audit-voice-note"),
] + router.urls
