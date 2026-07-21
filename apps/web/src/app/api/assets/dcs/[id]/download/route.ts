import { getAccessToken, internalApiUrl } from "@/lib/api/server";

/** Authenticated download proxy for a Delivery Challan's PDF.
 * The browser has no direct Django API token, so file links point here. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  const upstream = await fetch(`${internalApiUrl()}/api/v1/assets/dcs/${id}/download/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new Response("Unable to download this file.", { status: upstream.status });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const disposition = upstream.headers.get("content-disposition");
  if (contentType) headers.set("content-type", contentType);
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(upstream.body, { status: 200, headers });
}
