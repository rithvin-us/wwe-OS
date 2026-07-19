# Services

Independently deployable background/edge services. Each has its own Dockerfile,
dependencies, and release cadence. Services communicate with the core backend via
its API and message queue — never by importing module code.

| Service           | Responsibility                                         |
| ----------------- | ------------------------------------------------------ |
| `telegram-bot/`   | Telegram interface (commands, notifications)           |
| `email-service/`  | Outbound email delivery + inbound processing           |
| `webhook-engine/` | Outbound webhook delivery with retries                 |
| `ocr/`            | Document OCR / text extraction                         |
| `scheduler/`      | Cron-style scheduled job triggering                    |
| `worker/`         | Generic async task execution (queue consumer)          |
| `ai-engine/`      | AI inference (initially exposed via Cloudflare Tunnel) |

Standard layout: `Dockerfile`, `src/`, `tests/`, `config/`, `requirements.txt`.
