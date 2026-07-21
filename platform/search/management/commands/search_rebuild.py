"""Rebuild search indexes from their source objects.

Usage:
    python manage.py search_rebuild            # every registered index
    python manage.py search_rebuild purchase-bills
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from shared.exceptions import NotFoundError

from search import registry
from search.services import SearchService


class Command(BaseCommand):
    help = "Rebuild one or all registered search indexes."

    def add_arguments(self, parser) -> None:
        parser.add_argument("index", nargs="?", default="", help="Index name (default: all)")

    def handle(self, *args, **options) -> None:
        service = SearchService()
        if options["index"]:
            try:
                adapters = [registry.get(options["index"])]
            except NotFoundError as exc:
                raise CommandError(str(exc)) from exc
        else:
            adapters = registry.all_adapters()

        for adapter in adapters:
            if adapter.queryset is None:
                self.stdout.write(f"{adapter.index}: no rebuild source, skipped")
                continue
            count = service.rebuild(adapter.index)
            self.stdout.write(self.style.SUCCESS(f"{adapter.index}: {count} documents"))
