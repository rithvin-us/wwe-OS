# Face-AI Microservice

Standalone face **embedding + liveness** service for the HR attendance system.
It shares **no code** with the HR backend and holds **no gallery** — it turns one
image into a face template (and a liveness flag). The backend owns the enrolled
templates and does the 1:N cosine match locally, so **enrolled faces never leave
the HR database**.

```
selfie ──► POST /verify-face ──► { embedding, liveness }  ──► backend cosine 1:N
photo  ──► POST /enroll-face ──► { embedding }            ──► backend stores on employee
```

## Why a separate service?

The real recogniser (MTCNN + InsightFace ArcFace) needs ~1 GB RAM and ~1.5 GB of
wheels — too heavy for the backend's 512 MB Render tier. Splitting it out lets
the models run on a capable box (local GPU/CPU) exposed to Render through a
Cloudflare Tunnel, while the backend stays lean and falls back to a stub if the
AI is unreachable.

## Engines (`FACE_ENGINE`)

| value         | what it does                                             | deps                            |
| ------------- | -------------------------------------------------------- | ------------------------------- |
| `insightface` | real MTCNN detection + ArcFace embeddings + liveness     | `requirements-ml.txt` (~1.5 GB) |
| `stub`        | deterministic pseudo-embedding, same image → same vector | none — CI/wiring only           |

`production` / `arcface` are accepted aliases for `insightface`.

## Run it

```bash
cd face-ai
python -m venv .venv && . .venv/Scripts/activate      # Windows Git Bash
pip install -r requirements.txt                        # base (stub works now)

# --- real engine ---
pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
pip install -r requirements-ml.txt

cp .env.example .env      # set FACE_AI_API_KEY (must match the backend)
uvicorn app.main:app --host 0.0.0.0 --port 9000
```

Docker: `docker build -t face-ai ./face-ai && docker run -p 9000:9000 --env-file face-ai/.env face-ai`

Then expose it publicly with the Cloudflare Tunnel — see [`cloudflare/`](cloudflare/)
and `docs/Cloudflare_Setup.md`.

## Configuration

Everything is ENV-driven (`app/config.py`, template in `.env.example`). Key vars:

| var                                              | default         | meaning                                                      |
| ------------------------------------------------ | --------------- | ------------------------------------------------------------ |
| `FACE_ENGINE`                                    | `insightface`   | engine selector                                              |
| `FACE_MODEL`                                     | `buffalo_s`     | ArcFace pack (`buffalo_s` light / `buffalo_l` accurate)      |
| `FACE_AI_API_KEY`                                | _(empty)_       | shared secret required in `X-API-Key`; **set in production** |
| `FACE_DETECT_MIN_CONFIDENCE`                     | `0.90`          | MTCNN accept threshold                                       |
| `FACE_BLUR_MIN_VAR`                              | `40.0`          | enrol blur gate (Laplacian variance)                         |
| `FACE_SIDE_PROFILE_MAX_RATIO`                    | `0.35`          | enrol frontal-face gate                                      |
| `FACE_ENABLE_LIVENESS` / `FACE_LIVENESS_MIN_VAR` | `true` / `60.0` | silent anti-spoof                                            |

## Model lifecycle

Models load **once** in the FastAPI lifespan (warm start). If the load fails
(e.g. ML deps missing) the service still boots; `/health` reports `ready:false`
and the first face request **lazily retries** the load, returning a clear `503`
if it still cannot.

## Endpoints

See [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md). Summary: `POST /enroll-face`,
`POST /verify-face` (both need `X-API-Key`), `GET /health`, `GET /version` (open).

## Tests

```bash
cd face-ai && FACE_ENGINE=stub python -m pytest -q
```

Runs entirely on the stub engine — no ML deps, no network.
