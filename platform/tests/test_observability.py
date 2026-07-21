"""Observability tests — request ids, access metrics, JSON logging."""

from __future__ import annotations

import json
import logging
import re

from shared.logging_utils import JSONFormatter


def test_request_id_is_generated_and_returned(api, db):
    response = api.get("/healthz")
    assert re.fullmatch(r"[0-9a-f]{32}", response.headers["X-Request-ID"])


def test_supplied_request_id_is_echoed(api, db):
    response = api.get("/healthz", HTTP_X_REQUEST_ID="trace-42.a")
    assert response.headers["X-Request-ID"] == "trace-42.a"


def test_malformed_request_id_is_replaced(api, db):
    response = api.get("/healthz", HTTP_X_REQUEST_ID="bad id !! " + "x" * 100)
    assert re.fullmatch(r"[0-9a-f]{32}", response.headers["X-Request-ID"])


def test_metrics_endpoint_disabled_without_token(api, db):
    assert api.get("/metrics").status_code == 404


def test_metrics_endpoint_requires_token(api, db, settings):
    settings.METRICS_TOKEN = "scrape-secret"
    assert api.get("/metrics").status_code == 403
    assert api.get("/metrics", HTTP_AUTHORIZATION="Bearer wrong").status_code == 403

    response = api.get("/metrics", HTTP_AUTHORIZATION="Bearer scrape-secret")
    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/plain")
    assert b"wweos_request_duration_ms_count" in response.content


def test_requests_are_counted(api, db, settings):
    settings.METRICS_TOKEN = "scrape-secret"
    api.get("/api/v1/auth/me/")  # unauthenticated → 401, must be counted as 4xx

    body = api.get("/metrics", HTTP_AUTHORIZATION="Bearer scrape-secret").content.decode()
    match = re.search(r'wweos_requests_total\{method="GET",status="4xx"\} (\d+)', body)
    assert match is not None
    assert int(match.group(1)) >= 1


def test_health_probes_are_not_counted(api, db, settings):
    settings.METRICS_TOKEN = "scrape-secret"
    api.get("/healthz")
    api.get("/readyz")

    body = api.get("/metrics", HTTP_AUTHORIZATION="Bearer scrape-secret").content.decode()
    assert 'status="2xx"' not in body


def test_json_formatter_emits_valid_json():
    record = logging.LogRecord(
        "platform.test", logging.INFO, __file__, 1, "hello %s", ("world",), None
    )
    record.request_id = "abc123"
    payload = json.loads(JSONFormatter().format(record))
    assert payload["message"] == "hello world"
    assert payload["level"] == "INFO"
    assert payload["request_id"] == "abc123"
