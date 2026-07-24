from rest_framework.routers import DefaultRouter

from identity.views import SourceIdentityViewSet

router = DefaultRouter()
router.register("identities", SourceIdentityViewSet, basename="identity")

urlpatterns = router.urls
