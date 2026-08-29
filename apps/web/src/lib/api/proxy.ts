import "server-only";

import { getAccessToken, internalApiUrl } from "@/lib/api/server";

/**
 * Forward a request to the Django API with the session's access token attached,
 * streaming the upstream response straight back — status, body envelope and all.
 *
 * Unlike `djangoFetch` (which unwraps the envelope and throws on non-2xx), this
 * preserves the raw `{success,data}` / `{success,error}` payload and the status
 * code, which is what a browser `fetch` from a client component needs so it can
 * branch on `response.ok` and read the error message. It also passes binary
 * bodies through untouched, so the same helper serves a file download.
 *
 * The browser never holds a Django token; it calls these Next route handlers,
 * which call Django. For a multipart upload, pass the `FormData` as `body` and
 * leave `Content-Type` unset so `fetch` writes the correct boundary.
 */
export async function proxyToDjango(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let upstream: Response;
  try {
    upstream = await fetch(`${internalApiUrl()}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "service_unavailable", message: "Unable to reach the platform API." },
      },
      { status: 503 },
    );
  }

  const out = new Headers();
  const contentType = upstream.headers.get("content-type");
  const disposition = upstream.headers.get("content-disposition");
  if (contentType) out.set("content-type", contentType);
  if (disposition) out.set("content-disposition", disposition);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
