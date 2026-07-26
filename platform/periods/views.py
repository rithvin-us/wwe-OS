"""Business period API — periods, one period's detail by year/month, the
permanent Library's live counts, and lock/unlock.

Reads are open to anyone with `periods.view`; the only writes are locking and
unlocking, which need `periods.lock`. Everything else about a period is written
by PeriodService, called by modules after they store a file."""

from __future__ import annotations

from django.db.models import Count
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.views import ReadOnlyModelViewSet
from storage.models import StoredFile

from periods.models import BusinessPeriod
from periods.serializers import BusinessPeriodSerializer, UnlockPeriodSerializer
from periods.services import PeriodService

_RECENT_UPLOADS_LIMIT = 10


class PeriodViewSet(ReadOnlyModelViewSet):
    serializer_class = BusinessPeriodSerializer
    required_permissions = {
        "default": "periods.view",
        "lock": "periods.lock",
        "unlock": "periods.lock",
    }

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

    @action(
        detail=False,
        methods=["post"],
        url_path=r"(?P<year>\d{4})/(?P<month>\d{1,2})/lock",
    )
    def lock(self, request: Request, year: str = "", month: str = "") -> Response:
        """Close a month to further edits."""
        period = PeriodService().lock(
            tenant=request.user.tenant,
            year=int(year),
            month=int(month),
            actor=request.user,
        )
        return Response(BusinessPeriodSerializer(period).data)

    @action(
        detail=False,
        methods=["post"],
        url_path=r"(?P<year>\d{4})/(?P<month>\d{1,2})/unlock",
    )
    def unlock(self, request: Request, year: str = "", month: str = "") -> Response:
        """Reopen a month. A reason is required and is kept on the period."""
        payload = UnlockPeriodSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        period = PeriodService().unlock(
            tenant=request.user.tenant,
            year=int(year),
            month=int(month),
            reason=payload.validated_data["reason"],
            actor=request.user,
        )
        return Response(BusinessPeriodSerializer(period).data)
