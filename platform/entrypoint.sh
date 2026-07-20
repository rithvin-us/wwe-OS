#!/usr/bin/env sh
set -e

# Apply database migrations (idempotent). Permission + system-role seeding runs
# automatically via post_migrate signals.
python manage.py migrate --noinput

# Collect static assets for the OpenAPI UIs.
python manage.py collectstatic --noinput || true

# Start the app server.
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout "${GUNICORN_TIMEOUT:-60}"
