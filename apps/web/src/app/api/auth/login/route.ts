import { NextResponse } from "next/server";

import { ApiRequestError, type ApiEnvelope } from "@/lib/api/envelope";
import { ACCESS_COOKIE, internalApiUrl, REFRESH_COOKIE } from "@/lib/api/server";

interface TokenPair {
  access: string;
  refresh: string;
}

/**
 * Proxies to Django's /api/v1/auth/login/, then holds the resulting tokens
 * as httpOnly cookies instead of returning them to the browser. The client
 * only ever learns "signed in" or the error message — never the token
 * itself, so it's never reachable from client-side JavaScript (XSS-safe by
 * construction, not by discipline).
 */
export async function POST(request: Request) {
  const body = await request.json();

  const upstream = await fetch(`${internalApiUrl()}/api/v1/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await upstream.text();
  let envelope: ApiEnvelope<TokenPair>;
  try {
    envelope = JSON.parse(text) as ApiEnvelope<TokenPair>;
  } catch {
    return NextResponse.json(
      { message: `Backend returned non-JSON response (${upstream.status})`, code: "invalid_response" },
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
  const rememberMe = Boolean(body.remember_me);

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
    maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7,
  });

  return response;
}
