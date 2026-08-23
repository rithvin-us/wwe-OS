import { getAccessToken, internalApiUrl } from "@/lib/api/server";

/**
 * Authenticated file download proxy. The browser has no API token (it lives
 * in an httpOnly cookie only this server can read), so file links point here;
 * this handler attaches the token, fetches the bytes from Django, and streams
 * them straight back to the browser.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const inline = new URL(request.url).searchParams.get("inline");
  const token = await getAccessToken();
  const upstream = await fetch(
    `${internalApiUrl()}/api/v1/documents/documents/${id}/download/${inline ? "?inline=1" : ""}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    },
  );

  if (!upstream.ok) {
    return new Response("Unable to download this document.", { status: upstream.status });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const disposition = upstream.headers.get("content-disposition");
  if (contentType) headers.set("content-type", contentType);
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(upstream.body, { status: 200, headers });
}
