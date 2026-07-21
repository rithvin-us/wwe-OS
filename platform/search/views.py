"""Search API — one query surface across every registered index."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.permissions import HasPlatformPermission

from search.services import SearchService


class SearchView(APIView):
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "search.use"

    @extend_schema(
        tags=["search"],
        responses={200: OpenApiResponse(description="Ranked results, meta, facets.")},
    )
    def get(self, request: Request) -> Response:
        query = request.query_params.get("q", "")
        indexes = [i for i in request.query_params.get("indexes", "").split(",") if i]
        facets = [f for f in request.query_params.get("facets", "").split(",") if f]
        filters = {
            key.removeprefix("filter."): value
            for key, value in request.query_params.items()
            if key.startswith("filter.")
        }
        page = max(int(request.query_params.get("page", 1) or 1), 1)
        page_size = min(max(int(request.query_params.get("page_size", 20) or 20), 1), 100)
        return Response(
            SearchService().search(
                user=request.user,
                query=query,
                indexes=indexes or None,
                filters=filters,
                facets=facets,
                page=page,
                page_size=page_size,
            )
        )


class AutocompleteView(APIView):
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "search.use"

    @extend_schema(
        tags=["search"],
        responses={200: OpenApiResponse(description="Title suggestions for a prefix.")},
    )
    def get(self, request: Request) -> Response:
        prefix = request.query_params.get("q", "")
        return Response(SearchService().autocomplete(user=request.user, prefix=prefix))
