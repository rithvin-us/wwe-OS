import { NextResponse } from "next/server";
import { internalApiUrl } from "@/lib/api/server";

export async function POST(request: Request) {
  const webhookSecret = process.env.EMAIL_INGEST_WEBHOOK_SECRET;
  const presentedSecret = request.headers.get("x-email-ingest-secret");
  if (!webhookSecret || !presentedSecret || presentedSecret !== webhookSecret) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
  const body = await request.json();
  const serviceToken = process.env.INGESTION_SERVICE_TOKENS?.split(",")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("email-service:"))
    ?.slice("email-service:".length);
  if (!serviceToken) {
    return NextResponse.json({ message: "Email ingestion is not configured." }, { status: 503 });
  }

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
        tags: body.tags || body.labels || [],
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
