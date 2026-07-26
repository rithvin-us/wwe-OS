import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { internalApiUrl } from "@/lib/api/server";

/**
 * Proxies a generated statutory workbook out of the platform API.
 *
 * The browser cannot call Django directly — it never holds a token — so the
 * download passes through this Next.js server, which attaches the session's
 * access token from the httpOnly cookie. Same pattern as the other download
 * route handlers under `app/api`.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get("access_token")?.value;

  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const response = await fetch(`${internalApiUrl()}/api/v1/hr/registers/${id}/download/`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return new NextResponse("Register not found or access denied.", {
        status: response.status === 401 || response.status === 403 ? response.status : 404,
      });
    }

    return new NextResponse(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ??
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": response.headers.get("content-disposition") ?? "attachment",
      },
    });
  } catch {
    return new NextResponse("Failed to fetch the register from the server.", { status: 500 });
  }
}
