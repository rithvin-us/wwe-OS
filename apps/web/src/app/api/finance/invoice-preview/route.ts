import { getAccessToken, internalApiUrl } from "@/lib/api/server";

/** Renders the invoice as a watermarked PDF before it exists, so the operator
 * can look at the actual document rather than a summary of it. Reserves no
 * number and writes no file — see the backend's `preview_document`. */
export async function POST(request: Request): Promise<Response> {
  const token = await getAccessToken();
  const body = await request.text();

  const upstream = await fetch(`${internalApiUrl()}/api/v1/finance/invoices/preview-document/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    cache: "no-store",
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    return new Response(detail || "Unable to build the preview.", { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { "content-type": "application/pdf" },
  });
}
