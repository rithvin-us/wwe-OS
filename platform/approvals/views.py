"""Approval Center API — one inbox and one decide endpoint across every source."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from approvals.services import ApprovalService


class DecideSerializer(serializers.Serializer):
    kind = serializers.CharField()
    object_id = serializers.CharField()
    decision = serializers.ChoiceField(choices=["approve", "reject"])
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ApprovalListView(APIView):
    # Each source is permission-gated inside the service; any signed-in user may
    # ask, and only sees the approvals their permissions allow.
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["approvals"],
        responses={200: OpenApiResponse(description="Pending approvals, longest-waiting first.")},
    )
    def get(self, request: Request) -> Response:
        return Response(ApprovalService().pending(user=request.user))


class ApprovalDecideView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["approvals"], request=DecideSerializer)
    def post(self, request: Request) -> Response:
        payload = DecideSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        ApprovalService().decide(
            user=request.user,
            kind=data["kind"],
            object_id=data["object_id"],
            approve=data["decision"] == "approve",
            note=data["note"],
        )
        return Response({"ok": True})
