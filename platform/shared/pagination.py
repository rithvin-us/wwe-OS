"""Consistent pagination envelope for list endpoints."""

from __future__ import annotations

from collections import OrderedDict
from typing import Any

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsSetPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 200

    def get_paginated_response(self, data: Any) -> Response:
        return Response(
            OrderedDict(
                success=True,
                data=data,
                meta=OrderedDict(
                    count=self.page.paginator.count,
                    page=self.page.number,
                    pages=self.page.paginator.num_pages,
                    page_size=self.get_page_size(self.request),
                    next=self.get_next_link(),
                    previous=self.get_previous_link(),
                ),
            )
        )
