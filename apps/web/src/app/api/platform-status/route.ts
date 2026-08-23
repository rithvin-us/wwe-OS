import { NextResponse } from "next/server";

import { getRuntimeStatus } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/**
 * Real platform reachability for the shell's status indicators.
 *
 * The sidebar footer and the login badge used to render a hardcoded
 * "Connected" / "Systems Operational" that could never go red — they said
 * the same thing whether or not the backend was up. This route is the one
 * honest source they both read: it hits the kernel's /api/v1/ops/status/
 * and reports what actually came back.
 */
export async function GET() {
  const { data, reachable } = await getRuntimeStatus();

  const database = data.checks.database ?? null;
  const cache = data.checks.cache ?? null;

  // "operational" only when the backend answered AND its own dependency
  // checks passed. Anything else is degraded or down — never optimistic.
  const degraded = (database !== null && database !== "ok") || (cache !== null && cache !== "ok");
  const state: "operational" | "degraded" | "down" = !reachable
    ? "down"
    : degraded
      ? "degraded"
      : "operational";

  return NextResponse.json(
    { state, reachable, checks: { database, cache } },
    { headers: { "cache-control": "no-store" } },
  );
}
