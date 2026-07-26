import { NextResponse } from "next/server";
import { internalApiUrl } from "@/lib/api/server";

export async function POST(request: Request) {
  const body = await request.json();
  const serviceToken =
    process.env.INGESTION_SERVICE_TOKENS?.split(",")?.[0]?.split(":")?.[1] ||
    "default-service-token";

  try {
    const upstream = await fetch(`${internalApiUrl()}/api/v1/documents/ingest/email/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Service ${serviceToken}`,
      },
      body: JSON.stringify({
        sender: body.sender || body.from || "waterworksengineering@gmail.com",
        subject: body.subject || "",
        body: body.body || body.text || "",
        attachments: body.attachments || [],
      }),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => null);
    return NextResponse.json(data || { success: upstream.ok }, { status: upstream.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Email ingestion failed.";
    return NextResponse.json({ message }, { status: 503 });
  }
}
