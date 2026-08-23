import { NextResponse } from "next/server";

import { ApiRequestError, type ApiEnvelope } from "@/lib/api/envelope";
import { ACCESS_COOKIE, internalApiUrl, REFRESH_COOKIE } from "@/lib/api/server";

interface TokenPair {
  access: string;
  refresh: string;
}

/**
 * Proxies a captured selfie (+ liveness burst) to Django's
 * /api/v1/auth/face/login/, which runs a real 1:N match against enrolled
 * face templates via the face-ai microservice — no fabricated "always
 * succeeds" path. On a genuine match it holds the resulting tokens as
 * httpOnly cookies, exactly like /api/auth/login.
 */
export async function POST(request: Request) {
  const formData = await request.formData();

  const upstream = await fetch(`${internalApiUrl()}/api/v1/auth/face/login/`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  const text = await upstream.text();
  let envelope: ApiEnvelope<TokenPair>;
  try {
    envelope = JSON.parse(text) as ApiEnvelope<TokenPair>;
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

  const response = NextResponse.json({ success: true });

  response.cookies.set(ACCESS_COOKIE, envelope.data.access, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15, // matches the platform's 15-minute access token lifetime
  });
  response.cookies.set(REFRESH_COOKIE, envelope.data.refresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
