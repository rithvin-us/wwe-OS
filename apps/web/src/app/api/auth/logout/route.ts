import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_COOKIE, internalApiUrl, REFRESH_COOKIE } from "@/lib/api/server";

/**
 * Best-effort: blacklist the refresh token on the platform, then always
 * clear the local cookies regardless of whether that call succeeded — a
 * user must always be able to sign out locally, even if the backend is down.
 */
export async function POST() {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;

  if (refresh) {
    try {
      await fetch(`${internalApiUrl()}/api/v1/auth/logout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
        cache: "no-store",
      });
    } catch {
      // Backend unreachable — still clear the local session below.
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}
