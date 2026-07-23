import "server-only";

import { cookies } from "next/headers";

import { ApiRequestError, type ApiEnvelope } from "@/lib/api/envelope";

/**
 * Server-only access to the Django platform API. The browser never calls
 * Django directly and never sees a token — only this Next.js server does,
 * via an httpOnly cookie set by the /api/auth/* route handlers. Server
 * Components, Server Actions, and Route Handlers all go through this file.
 */

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export function internalApiUrl(): string {
  return process.env.INTERNAL_API_URL ?? "http://localhost:8000";
}

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}

/**
 * Call the Django API with the current session's access token attached.
 * Unwraps the `{success, data}` / `{success, error}` envelope; throws
 * `ApiRequestError` on failure so callers can branch on `.status`/`.code`
 * (see `isAuthError`) instead of re-parsing the envelope everywhere.
 */
export async function djangoFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${internalApiUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (response.ok && !text.trim()) {
    return null as T;
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new ApiRequestError(response.status, {
      code: "invalid_response",
      message: `Backend returned non-JSON response (${response.status}): ${text.slice(0, 150)}`,
      details: text,
    });
  }

  if (!envelope.success) {
    throw new ApiRequestError(response.status, envelope.error);
  }
  return envelope.data;
}
