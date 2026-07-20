from rest_framework.routers import DefaultRouter

from permissions.views import PermissionViewSet

router = DefaultRouter()
router.register("", PermissionViewSet, basename="permission")

urlpatterns = router.urls
