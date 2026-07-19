# Service · scheduler

Scheduled job triggering: cron definitions, enqueueing work for the worker, misfire handling.

## Layout

- `src/` — service source code
- `tests/` — service tests
- `config/` — service configuration
- `requirements.txt` — Python dependencies
- `Dockerfile` — container build

## Contract

- Talks to the core backend via API / message queue only.
- No imports from `modules/` or `platform/` source — API boundaries only.
- Configured entirely via environment variables (see root `.env.example`).
