import { NextResponse } from "next/server";
import { internalApiUrl, isAuthenticated } from "@/lib/api/server";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "Sign in to upload a bill." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ message: "File is over the 8MB limit." }, { status: 413 });
  }

  const serviceToken =
    process.env.INGESTION_SERVICE_TOKENS?.split(",")?.[0]?.split(":")?.[1] ||
    "default-service-token";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const upstream = await fetch(`${internalApiUrl()}/api/v1/purchase/bills/ingest/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Service ${serviceToken}`,
      },
      body: JSON.stringify({
        source_channel: "upload",
        document_base64: buffer.toString("base64"),
        caption: file.name,
      }),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => null);
    return NextResponse.json(data || { success: upstream.ok }, { status: upstream.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bill upload failed.";
    return NextResponse.json({ message }, { status: 503 });
  }
}
