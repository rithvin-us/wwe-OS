import { NextResponse } from "next/server";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

interface FaceStatus {
  enrolled: boolean;
  enrolled_at: string | null;
}

/**
 * Proxies to Django's /api/v1/auth/face/ — whether the signed-in user has a
 * face template enrolled. Authenticated only: this never runs unauthenticated,
 * so it never leaks who else has a face profile.
 */
export async function GET() {
  try {
    const data = await djangoFetch<FaceStatus>("/api/v1/auth/face/");
    return NextResponse.json(data);
  } catch (err) {
    const error = err instanceof ApiRequestError ? err : null;
    return NextResponse.json(
      { message: error?.message ?? "Could not load face enrollment status.", code: error?.code },
      { status: error?.status ?? 500 },
    );
  }
}
