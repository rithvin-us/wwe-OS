# Service · ocr

OCR pipeline: text extraction from scanned documents and images, feeding DMS and other modules through the platform.

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
