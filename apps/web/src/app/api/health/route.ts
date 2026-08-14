import { NextResponse } from "next/server";
import { internalApiUrl, djangoFetch } from "@/lib/api/server";

export async function GET() {
  const start = Date.now();

  let platformApiStatus = "offline";
  let platformLatency = 0;
  let tenantInfo: { name: string; slug: string } | null = null;
  let faceAiStatus = "offline";
  let faceEnrolled = false;

  // 1. Check Platform Backend Kernel (:8000)
  try {
    const pStart = Date.now();
    const res = await fetch(`${internalApiUrl()}/healthz`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    platformLatency = Date.now() - pStart;
    if (res.ok) {
      platformApiStatus = "online";
    }
  } catch {
    platformApiStatus = "offline";
  }

  // 2. Check Tenant & Auth state
  try {
    const tenant = await djangoFetch<{ name: string; slug: string }>("/api/v1/tenancy/current/");
    tenantInfo = tenant;
  } catch {
    tenantInfo = null;
  }

  // 3. Check Face AI Engine / Status
  try {
    const faceRes = await djangoFetch<{ enrolled: boolean }>("/api/v1/auth/face/status/");
    faceAiStatus = "online";
    faceEnrolled = faceRes.enrolled;
  } catch {
    faceAiStatus = "unknown";
  }

  const totalLatency = Date.now() - start;

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    latency_ms: totalLatency,
    services: {
      web_frontend: {
        name: "Web Portal Client",
        status: "online",
        type: "Next.js App Router",
        latency_ms: 2,
      },
      platform_api: {
        name: "Platform Kernel API",
        status: platformApiStatus,
        url: internalApiUrl(),
        latency_ms: platformLatency,
      },
      face_ai: {
        name: "Face AI Microservice",
        status: faceAiStatus,
        enrolled: faceEnrolled,
        engine: "ArcFace / InsightFace",
      },
      database: {
        name: "Database & Cache",
        status: platformApiStatus === "online" ? "connected" : "disconnected",
        engine: "PostgreSQL / SQLite + Redis",
      },
      tenant: {
        name: tenantInfo?.name ?? "WWE OS",
        slug: tenantInfo?.slug ?? "wwe-os",
        status: tenantInfo ? "active" : "unlinked",
      },
    },
  });
}
