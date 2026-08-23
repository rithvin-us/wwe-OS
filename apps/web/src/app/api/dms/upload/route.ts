import { NextResponse } from "next/server";

import { getAccessToken, internalApiUrl, isAuthenticated } from "@/lib/api/server";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // matches STORAGE_MAX_UPLOAD_MB

/**
 * POST /api/dms/upload
 *
 * Route Handler for document uploads. Server Actions have a known serialization
 * boundary issue with binary File objects in Next.js 15 — the `File` from the
 * browser FormData doesn't always survive the RSC flight protocol intact, which
 * causes "An unexpected error occurred" on the client.
 *
 * Route Handlers receive the raw HTTP request and handle multipart natively,
 * so file uploads work reliably. The access token still comes from the
 * httpOnly cookie — the browser never sees it.
 */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { ok: false, message: "You must be signed in to upload documents." },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid form data. Please try again." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, message: "Choose a file to upload." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, message: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.` },
      { status: 413 },
    );
  }

  const title = String(form.get("title") ?? "").trim();
  if (!title) {
    return NextResponse.json({ ok: false, message: "Give the document a title." }, { status: 400 });
  }

  const token = await getAccessToken();

  // Build a fresh FormData to forward to the Django backend.
  // Read the file bytes first so Node's fetch (undici) can stream them.
  const fileBytes = await file.arrayBuffer();
  const blob = new Blob([fileBytes], { type: file.type || "application/octet-stream" });

  const forward = new FormData();
  forward.append("file", blob, file.name || "document");
  forward.append("title", title);
  forward.append("category", String(form.get("category") ?? "other"));
  forward.append("description", String(form.get("description") ?? ""));

  // Tags come as a comma-separated hidden input; split and append individually
  const rawTags = String(form.get("tags") ?? "");
  for (const tag of rawTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)) {
    forward.append("tags", tag);
  }

  try {
    const upstream = await fetch(`${internalApiUrl()}/api/v1/documents/documents/`, {
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
        {
          ok: false,
          message: `Platform returned HTTP ${upstream.status}: ${text.slice(0, 120) || "empty response"}`,
        },
        { status: upstream.status },
      );
    }

    if (!upstream.ok || !(body as { success?: boolean })?.success) {
      const err = (body as { error?: { message?: string } })?.error;
      return NextResponse.json(
        { ok: false, message: err?.message ?? `Upload failed (HTTP ${upstream.status}).` },
        { status: upstream.status },
      );
    }

    return NextResponse.json({ ok: true, message: "Document uploaded.", data: body });
  } catch (err: unknown) {
    console.error("[/api/dms/upload] Upstream fetch error:", err);
    const message = err instanceof Error ? err.message : "Could not reach the platform backend.";
    return NextResponse.json({ ok: false, message }, { status: 503 });
  }
}
