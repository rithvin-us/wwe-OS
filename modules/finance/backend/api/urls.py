from __future__ import annotations

from django.urls import include, path
from finance.backend.api.import_views import (
    InvoiceImportBatchViewSet,
    InvoiceImportItemViewSet,
)
from finance.backend.api.views import CustomerViewSet, InvoiceViewSet, SiteViewSet
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="finance-customer")
router.register("invoices", InvoiceViewSet, basename="finance-invoice")
router.register("sites", SiteViewSet, basename="finance-site")
router.register("invoice-imports", InvoiceImportBatchViewSet, basename="finance-invoice-import")
router.register(
    "invoice-import-items", InvoiceImportItemViewSet, basename="finance-invoice-import-item"
)

urlpatterns = [path("", include(router.urls))]
