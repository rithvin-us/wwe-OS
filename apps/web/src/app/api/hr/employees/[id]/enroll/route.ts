import { NextResponse } from "next/server";

import { getAccessToken, internalApiUrl, isAuthenticated } from "@/lib/api/server";

/**
 * POST /api/hr/employees/[id]/enroll
 * Route Handler for enrolling an employee's face photo for biometric attendance.
 * Bypasses RSC boundary serialization issues with FormData/Blob objects.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, message: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing employee ID." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { ok: false, message: "Choose a face photo to upload." },
      { status: 400 },
    );
  }

  const token = await getAccessToken();
  const fileBytes = await file.arrayBuffer();
  const blob = new Blob([fileBytes], { type: file.type || "image/jpeg" });

  const forward = new FormData();
  forward.append("file", blob, file.name || "cropped_face.jpg");

  try {
    const upstream = await fetch(`${internalApiUrl()}/api/v1/hr/employees/${id}/enroll/`, {
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
        { ok: false, message: `Backend error (HTTP ${upstream.status}).` },
        { status: upstream.status },
      );
    }

    if (!upstream.ok || !(body as { success?: boolean })?.success) {
      const err = (body as { error?: { message?: string } })?.error;
      return NextResponse.json(
        { ok: false, message: err?.message ?? "Face enrollment failed." },
        { status: upstream.status },
      );
    }

    return NextResponse.json({ ok: true, message: "Face enrolled successfully." });
  } catch (err: unknown) {
    console.error("[/api/hr/employees/enroll] Upstream fetch error:", err);
    return NextResponse.json(
      { ok: false, message: "Could not reach platform API." },
      { status: 503 },
    );
  }
}
