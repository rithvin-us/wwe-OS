# Service · webhook-engine

Outbound webhook delivery: subscriptions, signing, retries with backoff, dead-letter handling.

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
