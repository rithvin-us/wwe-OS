from rest_framework.routers import DefaultRouter

from automation.views import AutomationRuleViewSet, AutomationRunViewSet

router = DefaultRouter()
router.register("rules", AutomationRuleViewSet, basename="automation-rule")
router.register("runs", AutomationRunViewSet, basename="automation-run")

urlpatterns = router.urls
