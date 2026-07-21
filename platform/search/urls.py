from __future__ import annotations

from django.urls import path

from search.views import AutocompleteView, SearchView

urlpatterns = [
    path("", SearchView.as_view(), name="search"),
    path("autocomplete/", AutocompleteView.as_view(), name="search-autocomplete"),
]
