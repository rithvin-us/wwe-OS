import { NextResponse } from "next/server";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

interface FaceStatus {
  enrolled: boolean;
  enrolled_at: string | null;
}

/**
 * Proxies a captured face photo to Django's /api/v1/auth/face/enroll/, which
 * calls the face-ai microservice (InsightFace ArcFace, buffalo_l) for a real
 * embedding and stores it against the signed-in user. Multipart body passes
 * straight through — djangoFetch skips the JSON Content-Type for FormData.
 */
export async function POST(request: Request) {
  const formData = await request.formData();

  try {
    const data = await djangoFetch<FaceStatus>("/api/v1/auth/face/enroll/", {
      method: "POST",
      body: formData,
    });
    return NextResponse.json(data);
  } catch (err) {
    const error = err instanceof ApiRequestError ? err : null;
    return NextResponse.json(
      { message: error?.message ?? "Could not enroll face profile.", code: error?.code },
      { status: error?.status ?? 500 },
    );
  }
}

export async function DELETE() {
  try {
    await djangoFetch("/api/v1/auth/face/enroll/", { method: "DELETE" });
    return NextResponse.json({ success: true });
  } catch (err) {
    const error = err instanceof ApiRequestError ? err : null;
    return NextResponse.json(
      { message: error?.message ?? "Could not remove face profile.", code: error?.code },
      { status: error?.status ?? 500 },
    );
  }
}
