"""Advances every active pipeline run one step. Meant to be invoked by an
external cron (one-shot, same operational shape as automation's own
automation_run_due), or run as a long-lived process with --loop for
pipelines that need faster-than-cron progress (e.g. live progress UI)."""

from __future__ import annotations

import time

from django.core.management.base import BaseCommand

from workflow.engine import tick_all


class Command(BaseCommand):
    help = "Advance every active pipeline run by one step."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--loop", action="store_true", help="Run forever, ticking on an interval."
        )
        parser.add_argument(
            "--interval",
            type=float,
            default=None,
            help="Seconds between ticks in --loop mode (default: PIPELINE_TICK_INTERVAL_SECONDS)",
        )

    def handle(self, *args, **options) -> None:
        from django.conf import settings

        interval = options["interval"] or settings.PIPELINE_TICK_INTERVAL_SECONDS
        if not options["loop"]:
            summary = tick_all()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Tick complete: {summary.advanced} advanced, {summary.reclaimed} reclaimed."
                )
            )
            return

        self.stdout.write(f"Ticking every {interval}s. Ctrl+C to stop.")
        while True:
            summary = tick_all()
            if summary.advanced or summary.reclaimed:
                self.stdout.write(f"advanced={summary.advanced} reclaimed={summary.reclaimed}")
            time.sleep(interval)
