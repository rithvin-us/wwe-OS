import { NextResponse } from "next/server";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

interface AssistantSource {
  title: string;
  url: string;
  index: string;
  excerpt: string;
}

interface AssistantAnswer {
  answer: string;
  sources: AssistantSource[];
  grounded: boolean;
}

/**
 * The grounded WWE OS assistant. The browser posts a question; this attaches
 * the operator's token and forwards it to the platform assistant endpoint,
 * which answers only from records the user is allowed to see and returns the
 * source records. No data ever leaves the authenticated server path.
 */
export async function POST(request: Request): Promise<Response> {
  let question = "";
  try {
    const body = (await request.json()) as { question?: string };
    question = (body.question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!question) {
    return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  }

  try {
    const data = await djangoFetch<AssistantAnswer>("/api/v1/ai/assistant/", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 500;
    const message =
      error instanceof ApiRequestError ? error.message : "The assistant is unavailable.";
    return NextResponse.json({ error: message }, { status });
  }
}
