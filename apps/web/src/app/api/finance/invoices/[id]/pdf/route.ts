import { getAccessToken, internalApiUrl } from "@/lib/api/server";

/** Authenticated proxy for an invoice's PDF — the copy that gets sent out.
 * Served inline so it opens in the browser's viewer. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  const upstream = await fetch(`${internalApiUrl()}/api/v1/finance/invoices/${id}/pdf/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new Response("Unable to open this invoice.", { status: upstream.status });
  }

  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") ?? "application/pdf");
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(upstream.body, { status: 200, headers });
}
