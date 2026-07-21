from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from workflow.views import WorkflowDefinitionViewSet, WorkflowInstanceViewSet

router = DefaultRouter()
router.register("definitions", WorkflowDefinitionViewSet, basename="workflow-definition")
router.register("instances", WorkflowInstanceViewSet, basename="workflow-instance")

urlpatterns = [path("", include(router.urls))]
