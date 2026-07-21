from __future__ import annotations

from django.urls import include, path
from inventory.backend.api.views import InventoryItemViewSet
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register("items", InventoryItemViewSet, basename="inventory-item")

urlpatterns = [path("", include(router.urls))]
