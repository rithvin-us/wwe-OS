import { NextRequest, NextResponse } from "next/server";
import { internalApiUrl } from "@/lib/api/server";
import { cookies } from "next/headers";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
      if (docUrl && (docUrl.startsWith("http://") || docUrl.startsWith("https://"))) {
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
