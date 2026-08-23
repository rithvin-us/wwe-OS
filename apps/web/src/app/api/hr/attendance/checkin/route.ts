import { NextResponse } from "next/server";

import { getAccessToken, internalApiUrl } from "@/lib/api/server";

/**
 * POST /api/hr/attendance/checkin
 * Route Handler for face recognition check-in kiosk.
 *
 * Deliberately unauthenticated — this proxies both the public /checkin page
 * (no login, shared link) and the logged-in admin kiosk dialog. The Django
 * view itself is AllowAny for the same reason (see CheckInView docstring);
 * gating it here would 401 every real employee using the public link.
 * Receives primary photo + burst frames + geolocation, forwards multipart to backend.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data." }, { status: 400 });
  }

  const token = await getAccessToken();
  const forward = new FormData();

  for (const [key, value] of form.entries()) {
    if (value instanceof File) {
      const bytes = await value.arrayBuffer();
      const blob = new Blob([bytes], { type: value.type || "image/jpeg" });
      forward.append(key, blob, value.name || `${key}.jpg`);
    } else {
      forward.append(key, value);
    }
  }

  try {
    const upstream = await fetch(`${internalApiUrl()}/api/v1/hr/attendance/checkin/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: forward,
      cache: "no-store",
    });

    const text = await upstream.text();
    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: `Backend error (HTTP ${upstream.status}).` },
        { status: upstream.status },
      );
    }

    // CheckInView returns CheckInResponseSerializer's payload directly on
    // success (no {success, data} envelope — that's only the shared error
    // handler's shape, used solely on failure). Checking body.success here
    // was always undefined on a real 200, so this branch used to swallow
    // every successful check-in and fabricate "Face check-in failed." while
    // still passing through the upstream 200 status.
    if (!upstream.ok) {
      const err = (body as { error?: { message?: string; details?: Record<string, unknown> } })
        ?.error;
      // The platform's generic handler collapses any multi-field ValidationError
      // to "One or more fields are invalid." and moves the real, user-facing
      // reason (e.g. "Face not recognized...", a liveness/blur rejection) into
      // error.details — prefer that over the generic message when present.
      const firstDetail = Object.values(err?.details ?? {}).find(
        (v): v is string[] => Array.isArray(v) && v.length > 0 && typeof v[0] === "string",
      )?.[0];
      return NextResponse.json(
        { ok: false, error: firstDetail ?? err?.message ?? "Face check-in failed." },
        { status: upstream.status },
      );
    }

    return NextResponse.json({ ok: true, data: body });
  } catch (err: unknown) {
    console.error("[/api/hr/attendance/checkin] Upstream fetch error:", err);
    return NextResponse.json(
      { ok: false, error: "Could not reach platform API." },
      { status: 503 },
    );
  }
}
