from rest_framework.routers import DefaultRouter

from alerts.views import AlertRuleViewSet

router = DefaultRouter()
router.register("rules", AlertRuleViewSet, basename="alert-rule")

urlpatterns = router.urls
