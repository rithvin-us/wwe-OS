# 06. Environment Variables & External Dependencies

## Environment Variables Reference

All runtime parameters are configured through environment variables (defined in `.env`).

### Core & Django Kernel
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `APP_ENV` | Application environment (`development` / `production`). | `development` |
| `DJANGO_SECRET_KEY` | Secret key for Django cryptographic signing (32+ chars). | `insecure-dev-key...` |
| `DJANGO_DEBUG` | Enable Django debug mode (`1` for dev, `0` for prod). | `1` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated list of allowed host header domains. | `localhost,127.0.0.1,backend` |
| `BACKEND_PORT` | Port exposed by the Django backend server. | `8000` |
| `CORS_ALLOWED_ORIGINS` | Allowed origins for cross-origin browser requests. | `http://localhost:3000` |

### Database & Cache
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `POSTGRES_USER` | PostgreSQL database user. | `bop` |
| `POSTGRES_PASSWORD` | PostgreSQL database password. | `bop` |
| `POSTGRES_DB` | Primary PostgreSQL database name. | `bop` |
| `DATABASE_URL` | Full PostgreSQL connection string. | `postgresql://bop:bop@postgres:5432/bop` |
| `REDIS_URL` | Redis connection URL for caching & task queues. | `redis://redis:6379/0` |

### Storage Backend
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `STORAGE_BACKEND` | Active storage provider (`local`, `s3`, `r2`). | `local` |
| `STORAGE_LOCAL_PATH` | Directory for local file storage in dev mode. | `.storage` |
| `STORAGE_MAX_UPLOAD_MB` | Maximum allowed file upload size in MB. | `25` |
| `STORAGE_S3_BUCKET` | Bucket name for S3 / Cloudflare R2 object storage. | `wwe-storage-bucket` |
| `STORAGE_S3_ENDPOINT_URL` | Custom endpoint URL for Cloudflare R2 / MinIO. | `https://<account-id>.r2.cloudflarestorage.com` |
| `STORAGE_S3_ACCESS_KEY_ID` | Access key ID for S3-compatible storage. | `aws-access-key-id` |
| `STORAGE_S3_SECRET_ACCESS_KEY` | Secret access key for S3-compatible storage. | `aws-secret-access-key` |

### AI Gateway & OCR
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | API key for OpenAI Vision (GPT-4o OCR for receipts). | `sk-proj-...` |
| `OCR_MODEL` | Vision model name used for receipt parsing. | `gpt-4o` |
| `AI_DEFAULT_MODEL` | Platform AI gateway default model (`mock`, `gpt-4o`, `claude-3-5-sonnet`). | `mock` |
| `AI_TENANT_HOURLY_LIMIT` | Maximum AI requests per hour per tenant. | `200` |

### Telegram Bot & Service Auth
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | API token issued by Telegram BotFather. | `8811942921:AAEZex...` |
| `PLATFORM_API_URL` | Backend URL accessible by the Telegram bot container. | `http://backend:8000` |
| `PLATFORM_SERVICE_TOKEN` | Shared secret token for Telegram bot API authentication. | `dev-only-change-me` |
| `INGESTION_SERVICE_TOKENS` | CSV list of `service:token` pairs configured on backend. | `telegram-bot:dev-only-change-me` |

---

## External Services & Dependencies

```mermaid
flowchart TD
    PLATFORM[WWE OS Platform]

    PLATFORM -->|Database| PG[(PostgreSQL 16)]
    PLATFORM -->|Queue / Cache| REDIS[(Redis 7)]
    PLATFORM -->|Email Dev Sink| MAILPIT[(Mailpit)]
    PLATFORM -->|File Storage| R2[(Cloudflare R2 / S3)]
    PLATFORM -->|Receipt OCR| OPENAI[(OpenAI Vision API)]
    PLATFORM -->|Bot Channel| TG[(Telegram Bot API)]
```

- **PostgreSQL 16:** Relational database for all tenant and business module records.
- **Redis 7:** Session caching, rate limiting, and pub/sub message queues.
- **Cloudflare R2 / AWS S3:** S3-compatible object storage for PDF Delivery Challans and document attachments.
- **OpenAI Vision API (GPT-4o):** Powers receipt OCR extraction for incoming purchase bills.
- **Telegram Bot API:** Mobile receipt capture channel.
- **Mailpit:** Local SMTP server sink for testing email output during development.
