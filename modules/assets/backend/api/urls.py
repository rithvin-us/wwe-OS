from __future__ import annotations

from assets.backend.api.views import AssetViewSet
from django.urls import include, path
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register("assets", AssetViewSet, basename="asset")

urlpatterns = [path("", include(router.urls))]
