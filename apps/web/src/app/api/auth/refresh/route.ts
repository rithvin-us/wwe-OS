import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { ApiEnvelope } from "@/lib/api/envelope";
import { ACCESS_COOKIE, internalApiUrl, REFRESH_COOKIE } from "@/lib/api/server";

/**
 * Exchanges the refresh cookie for a new access token. Called by the client
 * shell when a request comes back unauthenticated (see
 * `src/components/session-guard.tsx`) — the access token's 15-minute
 * lifetime is short enough that this is a normal, expected occurrence, not
 * an error state.
 */
export async function POST() {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;

  if (!refresh) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const upstream = await fetch(`${internalApiUrl()}/api/v1/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
    cache: "no-store",
  });

  const text = await upstream.text();
  let envelope: ApiEnvelope<{ access: string; refresh: string }>;
  try {
    envelope = JSON.parse(text) as ApiEnvelope<{ access: string; refresh: string }>;
  } catch {
    const response = NextResponse.json({ success: false }, { status: upstream.status || 500 });
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  if (!envelope.success) {
    const response = NextResponse.json({ success: false }, { status: upstream.status });
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ACCESS_COOKIE, envelope.data.access, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  // Django rotates and blacklists refresh tokens. Persist the replacement or
  // every session fails on its second refresh.
  const payload = JSON.parse(
    Buffer.from(envelope.data.refresh.split(".")[1] ?? "", "base64url").toString("utf8"),
  ) as { exp?: number };
  const maxAge = payload.exp ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000)) : 0;
  if (!maxAge) {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }
  response.cookies.set(REFRESH_COOKIE, envelope.data.refresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return response;
}
