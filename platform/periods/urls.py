from rest_framework.routers import DefaultRouter

from periods.views import PeriodViewSet

router = DefaultRouter()
router.register("", PeriodViewSet, basename="period")

urlpatterns = router.urls
