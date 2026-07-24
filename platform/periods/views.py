"""Business period read API — periods, one period's detail by year/month,
and the permanent Library's live counts. Read-only: writes to periods
happen through PeriodService, called by modules after they store a file."""

from __future__ import annotations

from django.db.models import Count
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.views import ReadOnlyModelViewSet
from storage.models import StoredFile

from periods.models import BusinessPeriod
from periods.serializers import BusinessPeriodSerializer

_RECENT_UPLOADS_LIMIT = 10


class PeriodViewSet(ReadOnlyModelViewSet):
    serializer_class = BusinessPeriodSerializer
    required_permissions = {"default": "periods.view"}

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return BusinessPeriod.objects.none()
        user = self.request.user
        qs = BusinessPeriod.objects.select_related("manifest").order_by("-year", "-month")
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    @action(detail=False, methods=["get"], url_path=r"(?P<year>\d{4})/(?P<month>\d{1,2})")
    def by_month(self, request: Request, year: str = "", month: str = "") -> Response:
        period = self.get_queryset().filter(year=int(year), month=int(month)).first()
        if period is None:
            return Response({"data": None}, status=200)

        recent = (
            StoredFile.objects.filter(
                tenant=period.tenant, period_year=period.year, period_month=period.month
            )
            .order_by("-created_at")[:_RECENT_UPLOADS_LIMIT]
            .values("id", "filename", "category", "created_at")
        )
        data = BusinessPeriodSerializer(period).data
        data["recent_uploads"] = list(recent)
        return Response(data)

    @action(detail=False, methods=["get"])
    def library(self, request: Request) -> Response:
        user = request.user
        qs = StoredFile.objects.filter(is_library=True)
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        rows = qs.values("category").annotate(count=Count("id"))
        document_counts = {row["category"]: row["count"] for row in rows if row["category"]}
        return Response(
            {"document_counts": document_counts, "total_count": sum(document_counts.values())}
        )
