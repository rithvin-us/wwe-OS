#!/usr/bin/env python
"""
End-to-end smoke test for a *running* Face-AI service (local or via the tunnel).

Unlike tests/test_api.py (in-process TestClient), this hits a real URL over the
network, so it validates the deployment + Cloudflare Tunnel + API-key gate. It
adapts to whichever engine is live (read from /version):

  * stub        -> any non-empty bytes yield an embedding
  * insightface -> pass --sample <frontal face jpg>; random bytes must 422

Usage:
  python face-ai/smoke_test.py --url http://localhost:9000 --api-key KEY
  python face-ai/smoke_test.py --url https://face-ai.example.com --api-key KEY --sample me.jpg

Exit code is non-zero if any check fails, so it can gate a deploy in CI.
"""

import argparse
import sys

import httpx

PASS, FAIL = "PASS", "FAIL"
_results: list[tuple[str, str, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    _results.append((name, PASS if ok else FAIL, detail))
    print(f"  [{PASS if ok else FAIL}] {name}" + (f" - {detail}" if detail else ""))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:9000")
    ap.add_argument("--api-key", default="")
    ap.add_argument("--sample", default=None, help="frontal face image (for insightface engine)")
    args = ap.parse_args()

    base = args.url.rstrip("/")
    hdr = {"X-API-Key": args.api_key} if args.api_key else {}
    client = httpx.Client(base_url=base, timeout=30.0)

    print(f"Face-AI smoke test -> {base}")

    # 1. health
    try:
        h = client.get("/health").json()
        check(
            "GET /health",
            h.get("status") == "ok",
            f"engine={h.get('engine')} ready={h.get('ready')}",
        )
    except Exception as exc:  # noqa: BLE001
        check("GET /health", False, str(exc))
        return _summary()

    # 2. version -> engine
    v = client.get("/version").json()
    engine = v.get("engine", "")
    check(
        "GET /version",
        bool(v.get("version")),
        f"v{v.get('version')} model={v.get('model')} dim={v.get('embedding_dim')}",
    )

    # 3. auth gate (only when a key is configured server-side)
    if args.api_key:
        r = client.post("/verify-face", files={"file": ("x.jpg", b"x", "image/jpeg")})
        check("POST /verify-face without key -> 401", r.status_code == 401, f"got {r.status_code}")

    # 4. empty upload -> 400
    r = client.post("/enroll-face", headers=hdr, files={"file": ("e.jpg", b"", "image/jpeg")})
    check("POST /enroll-face empty -> 400", r.status_code == 400, f"got {r.status_code}")

    # 5. engine-specific embedding behaviour
    if engine == "stub":
        r = client.post(
            "/verify-face", headers=hdr, files={"file": ("s.jpg", b"pretend", "image/jpeg")}
        )
        ok = r.status_code == 200 and len(r.json().get("embedding", [])) > 0
        check("POST /verify-face (stub) -> embedding", ok, f"got {r.status_code}")
    else:
        # No-face case: random bytes must be rejected 422 by a real detector.
        r = client.post(
            "/verify-face", headers=hdr, files={"file": ("n.jpg", b"\x00" * 2048, "image/jpeg")}
        )
        check("POST /verify-face no-face -> 422", r.status_code == 422, f"got {r.status_code}")
        if args.sample:
            with open(args.sample, "rb") as f:
                img = f.read()
            r = client.post(
                "/enroll-face", headers=hdr, files={"file": ("me.jpg", img, "image/jpeg")}
            )
            ok = r.status_code == 200 and len(r.json().get("embedding", [])) == v.get(
                "embedding_dim"
            )
            check("POST /enroll-face (sample) -> embedding", ok, f"got {r.status_code}")
        else:
            print("  [SKIP] enrol with real face — pass --sample <face.jpg> to test recognition")

    return _summary()


def _summary() -> int:
    failed = [r for r in _results if r[1] == FAIL]
    print(f"\n{len(_results) - len(failed)}/{len(_results)} passed")
    if failed:
        print("FAILED: " + ", ".join(r[0] for r in failed))
        return 1
    print("SMOKE OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
