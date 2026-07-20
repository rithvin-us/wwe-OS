from rest_framework.routers import DefaultRouter

from audit.views import AuditLogViewSet

router = DefaultRouter()
router.register("", AuditLogViewSet, basename="audit")

urlpatterns = router.urls
