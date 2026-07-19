# Service · telegram-bot

Telegram interface: bot commands, conversational flows, and delivery channel for platform notifications. Deployed as an independent service.

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
