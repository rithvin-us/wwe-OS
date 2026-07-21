from __future__ import annotations

from assets.backend.api.dc_views import DeliveryChallanViewSet, SiteViewSet
from assets.backend.api.views import AssetViewSet
from django.urls import include, path
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register("assets", AssetViewSet, basename="asset")
router.register("sites", SiteViewSet, basename="site")
router.register("dcs", DeliveryChallanViewSet, basename="deliverychallan")

urlpatterns = [path("", include(router.urls))]
