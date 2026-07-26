# Face-AI API

Base URL (local): `http://localhost:9000` · (prod): the Cloudflare Tunnel HTTPS
hostname. All bodies are JSON. Face endpoints require header `X-API-Key: <key>`
when `FACE_AI_API_KEY` is set.

Embeddings are **L2-normalised** `float` vectors (512-dim for `buffalo_*`,
16-dim for the stub). Cosine similarity therefore equals the dot product; the
backend accepts a match at cosine ≥ `FACE_MATCH_THRESHOLD` (default 0.45).

---

## `POST /enroll-face` 🔒

Strict-gate embedding for an enrolment reference photo. Rejects blurry,
side-profile, multiple, and too-small faces.

**Request** — `multipart/form-data`

| field  | type | notes                           |
| ------ | ---- | ------------------------------- |
| `file` | file | reference face photo (JPEG/PNG) |

**200**

```json
{ "embedding": [0.01, -0.04, ...], "dim": 512, "engine": "insightface", "model": "buffalo_s" }
```

```bash
curl -X POST http://localhost:9000/enroll-face \
  -H "X-API-Key: $FACE_AI_API_KEY" -F "file=@ref.jpg"
```

---

## `POST /verify-face` 🔒

Liveness check + probe embedding for a check-in selfie. **Does not match** —
the caller (backend) runs the 1:N cosine against its own enrolled gallery.

**Request** — `multipart/form-data` with `file` (live selfie).

**200**

```json
{ "embedding": [...], "dim": 512, "liveness": true, "engine": "insightface", "model": "buffalo_s" }
```

---

## `GET /health` (open)

Liveness/readiness probe for Cloudflare / Render / the backend circuit breaker.

**200** — `{ "status": "ok", "engine": "insightface", "model": "buffalo_s", "ready": true }`
`ready:false` means models are not yet resident (warm-up failed / still loading).

## `GET /version` (open)

`{ "service": "face-ai", "version": "1.0.0", "engine": "insightface", "model": "buffalo_s", "detector": "mtcnn", "embedding_dim": 512 }`

---

## Errors

| status | when                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| `400`  | empty upload                                                                                                    |
| `401`  | missing/invalid `X-API-Key` (when a key is configured)                                                          |
| `422`  | face-quality failure — `detail` is user-safe (no face / multiple faces / too small / too blurry / side profile) |
| `503`  | model load failed (deps missing / OOM)                                                                          |

`422` bodies: `{ "detail": "Multiple faces detected. Only one person may be in frame." }`
