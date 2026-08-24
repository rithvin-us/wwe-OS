import { NextResponse } from "next/server";

import { ApiRequestError, type ApiEnvelope } from "@/lib/api/envelope";
import { internalApiUrl } from "@/lib/api/server";

/**
 * Proxies to Django's /api/v1/auth/password/reset/. The backend always
 * responds the same way whether or not the email exists (anti-enumeration),
 * so this route just relays success or a real transport/throttle error — it
 * never fabricates a "sent" state.
 */
export async function POST(request: Request) {
  const body = await request.json();

  const upstream = await fetch(`${internalApiUrl()}/api/v1/auth/password/reset/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email }),
    cache: "no-store",
  });

  const text = await upstream.text();
  let envelope: ApiEnvelope<{ detail: string }>;
  try {
    envelope = JSON.parse(text) as ApiEnvelope<{ detail: string }>;
  } catch {
    return NextResponse.json(
      {
        message: `Backend returned non-JSON response (${upstream.status})`,
        code: "invalid_response",
      },
      { status: upstream.status || 500 },
    );
  }

  if (!envelope.success) {
    const error = new ApiRequestError(upstream.status, envelope.error);
    return NextResponse.json(
      { message: error.message, code: error.code },
      { status: upstream.status },
    );
  }

  return NextResponse.json({ success: true });
}
