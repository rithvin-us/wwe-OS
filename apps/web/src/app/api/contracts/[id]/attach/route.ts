import { NextResponse } from "next/server";

import { getAccessToken, internalApiUrl, isAuthenticated } from "@/lib/api/server";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * POST /api/contracts/[id]/attach
 *
 * Route Handler for attaching signed contract files.
 * Replaces the broken Server Action to avoid Next.js RSC serialization issues with File objects.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { ok: false, message: "You must be signed in to attach contract files." },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing contract ID." }, { status: 400 });
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
    return NextResponse.json({ ok: false, message: "Choose a file to attach." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, message: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.` },
      { status: 413 },
    );
  }

  const token = await getAccessToken();

  const fileBytes = await file.arrayBuffer();
  const blob = new Blob([fileBytes], { type: file.type || "application/octet-stream" });

  const forward = new FormData();
  forward.append("file", blob, file.name || "contract");

  try {
    const upstream = await fetch(`${internalApiUrl()}/api/v1/contracts/contracts/${id}/attach/`, {
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
        { ok: false, message: err?.message ?? `Attach failed (HTTP ${upstream.status}).` },
        { status: upstream.status },
      );
    }

    return NextResponse.json({ ok: true, message: "File attached." });
  } catch (err: unknown) {
    console.error("[/api/contracts/attach] Upstream fetch error:", err);
    const message = err instanceof Error ? err.message : "Could not reach the platform backend.";
    return NextResponse.json({ ok: false, message }, { status: 503 });
  }
}
