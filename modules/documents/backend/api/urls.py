from __future__ import annotations

from django.urls import include, path
from documents.backend.api.views import DocumentViewSet
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register("documents", DocumentViewSet, basename="document")

urlpatterns = [path("", include(router.urls))]
