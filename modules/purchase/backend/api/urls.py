from django.urls import path
from rest_framework.routers import DefaultRouter

from purchase.backend.api.views import IngestBillView, PurchaseBillViewSet, VendorViewSet

router = DefaultRouter()
router.register("bills", PurchaseBillViewSet, basename="purchase-bill")
router.register("vendors", VendorViewSet, basename="purchase-vendor")

urlpatterns = [
    path("bills/ingest/", IngestBillView.as_view(), name="purchase-bill-ingest"),
    *router.urls,
]
