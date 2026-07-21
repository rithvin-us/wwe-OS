import { internalApiUrl } from "@/lib/api/server";

/**
 * Proxy for platform storage signed downloads. The signed URL the backend
 * mints (`/api/v1/storage/download/?token=…`) points at Django, which the
 * browser can't reach directly; this forwards the (unguessable, expiring)
 * token to the backend and streams the file back. The token itself is the
 * credential — no session is required, matching the storage design.
 */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("Missing token.", { status: 400 });

  const upstream = await fetch(
    `${internalApiUrl()}/api/v1/storage/download/?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!upstream.ok) {
    return new Response("This download link is no longer valid.", { status: upstream.status });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const disposition = upstream.headers.get("content-disposition");
  if (contentType) headers.set("content-type", contentType);
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(upstream.body, { status: 200, headers });
}
