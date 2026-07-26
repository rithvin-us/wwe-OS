import { NextRequest, NextResponse } from "next/server";
import { internalApiUrl } from "@/lib/api/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    if (!res.ok) {
      return new NextResponse("File not found or access denied.", { status: res.status });
    }

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
  } catch {
    return new NextResponse("Failed to fetch file from server.", { status: 500 });
  }
}
