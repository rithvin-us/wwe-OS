import { getAccessToken, internalApiUrl } from "@/lib/api/server";

/**
 * Authenticated inline preview proxy. Same idea as the download route, but
 * hits the `preview` endpoint, which streams the file with an `inline`
 * disposition for browser-safe types (PDF, images, text) so it renders in a
 * tab instead of downloading. Unsafe types come back as an attachment.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  const upstream = await fetch(`${internalApiUrl()}/api/v1/documents/documents/${id}/preview/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new Response("Unable to preview this document.", { status: upstream.status });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const disposition = upstream.headers.get("content-disposition");
  if (contentType) headers.set("content-type", contentType);
  if (disposition) headers.set("content-disposition", disposition);
  headers.set("x-content-type-options", "nosniff");
  return new Response(upstream.body, { status: 200, headers });
}
