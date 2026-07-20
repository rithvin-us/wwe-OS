from rest_framework.routers import DefaultRouter

from roles.views import RoleViewSet

router = DefaultRouter()
router.register("", RoleViewSet, basename="role")

urlpatterns = router.urls
