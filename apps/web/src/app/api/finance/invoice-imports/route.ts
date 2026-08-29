import { proxyToDjango } from "@/lib/api/proxy";

/** List import batches. */
export async function GET(request: Request): Promise<Response> {
  const { search } = new URL(request.url);
  return proxyToDjango(`/api/v1/finance/invoice-imports/${search}`);
}

/** Upload a batch of invoice scans (multipart `files[]` + optional `label`).
 * The FormData is forwarded as-is so `fetch` writes the multipart boundary. */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  return proxyToDjango("/api/v1/finance/invoice-imports/", { method: "POST", body: form });
}
