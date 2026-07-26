import { NextResponse } from "next/server";

import { ApiRequestError, type ApiEnvelope } from "@/lib/api/envelope";
import { internalApiUrl } from "@/lib/api/server";

interface GenerateResult {
  text: string;
  model: string;
  provider: string;
}

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const upstream = await fetch(`${internalApiUrl()}/api/v1/ai/generate/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        user: body.prompt || body.user,
        use_case: "dashboard-qa",
        cache_ttl: 0,
      }),
      cache: "no-store",
    });

    const text = await upstream.text();
    let envelope: ApiEnvelope<GenerateResult>;
    try {
      envelope = JSON.parse(text) as ApiEnvelope<GenerateResult>;
    } catch {
      return NextResponse.json(
        {
          message: `Backend returned non-JSON response (${upstream.status})`,
        },
        { status: upstream.status || 500 },
      );
    }

    if (!envelope.success) {
      const error = new ApiRequestError(upstream.status, envelope.error);
      return NextResponse.json({ message: error.message }, { status: upstream.status });
    }

    return NextResponse.json({ text: envelope.data.text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI generation service unavailable.";
    return NextResponse.json({ message }, { status: 503 });
  }
}
