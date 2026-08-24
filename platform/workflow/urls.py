from rest_framework.routers import DefaultRouter

from workflow.views import PipelineCatalogViewSet, PipelineRunViewSet

router = DefaultRouter()
router.register("pipelines", PipelineCatalogViewSet, basename="pipeline")
router.register("runs", PipelineRunViewSet, basename="pipeline-run")

urlpatterns = router.urls
