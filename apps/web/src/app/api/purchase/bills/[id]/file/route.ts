import { NextRequest, NextResponse } from "next/server";
import { internalApiUrl } from "@/lib/api/server";
import { cookies } from "next/headers";

/**
 * `document_url` is stored by the backend from untrusted ingest paths (Telegram
 * upload, OCR, direct API write), so fetching it unchecked would make this route
 * a server-side request proxy. Only configured origins may be fetched.
 */
/**
 * Telegram is a first-class ingest channel for purchase bills, so its file host
 * is allowed by name rather than by configuration. Note that a Telegram file
 * URL embeds the bot token in its path -- never log or echo one.
 */
const STATIC_ALLOWED_HOSTS = ["api.telegram.org"];

function allowedDocumentHosts(): Set<string> {
  const hosts = new Set<string>(STATIC_ALLOWED_HOSTS);
  for (const origin of [
    internalApiUrl(),
    process.env.STORAGE_S3_ENDPOINT_URL,
    process.env.DOCUMENT_STORAGE_URL,
  ]) {
    if (!origin) continue;
    try {
      hosts.add(new URL(origin).hostname.toLowerCase());
    } catch {
      // Misconfigured origin contributes nothing to the allowlist.
    }
  }
  return hosts;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || host === "0.0.0.0") {
    return true;
  }
  const parts = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!parts) return false;
  const a = Number(parts[1]);
  const b = Number(parts[2]);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isAllowedDocumentUrl(docUrl: unknown): docUrl is string {
  if (typeof docUrl !== "string" || !docUrl) return false;
  let parsed: URL;
  try {
    parsed = new URL(docUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  const host = parsed.hostname.toLowerCase();
  const allowed = allowedDocumentHosts();
  // Allowlist first: local dev legitimately points the API origin at 127.0.0.1.
  if (allowed.has(host)) return true;
  // Anything not explicitly configured must not be a private/link-local target.
  if (isPrivateHost(host)) return false;
  return Array.from(allowed).some((allowedHost) => host.endsWith(`.${allowedHost}`));
}

/** Bill ids are backend pks. Anything else is a path-traversal attempt. */
const BILL_ID_PATTERN = /^[0-9a-fA-F-]{1,64}$/;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Guard before interpolating into the backend URL: an unchecked id would
  // redirect this authenticated request to an arbitrary platform endpoint.
  if (!BILL_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "File not found or access denied." }, { status: 404 });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  const backendUrl = `${internalApiUrl()}/api/v1/purchase/bills/${id}/file/`;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(backendUrl, { headers, cache: "no-store" });
    if (res.ok) {
      const data = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "application/pdf";
      const contentDisposition = res.headers.get("content-disposition") || "inline";

      return new NextResponse(data, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": contentDisposition,
        },
      });
    }

    // Fallback: If Django container returns non-200 (e.g. storage_key empty & container network blocked),
    // fetch bill.document_url directly from host Next.js server!
    const billRes = await fetch(`${internalApiUrl()}/api/v1/purchase/bills/${id}/`, {
      headers,
      cache: "no-store",
    });
    if (billRes.ok) {
      const billData = await billRes.json();
      const docUrl = billData?.document_url;
      if (isAllowedDocumentUrl(docUrl)) {
        const extRes = await fetch(docUrl, { cache: "no-store" });
        if (extRes.ok) {
          const extData = await extRes.arrayBuffer();
          const extContentType =
            extRes.headers.get("content-type") ||
            (docUrl.toLowerCase().includes(".pdf") ? "application/pdf" : "image/jpeg");
          return new NextResponse(extData, {
            status: 200,
            headers: {
              "Content-Type": extContentType,
              "Content-Disposition": 'inline; filename="document.pdf"',
            },
          });
        }
      }
    }

    return new NextResponse("File not found or access denied.", { status: 404 });
  } catch {
    return new NextResponse("Failed to fetch file from server.", { status: 500 });
  }
}
