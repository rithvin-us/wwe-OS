import { NextResponse } from "next/server";

import { getReadiness } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/**
 * Real platform reachability for the shell's status indicators.
 *
 * The sidebar footer and the login badge used to render a hardcoded
 * "Connected" / "Systems Operational" that could never go red — they said
 * the same thing whether or not the backend was up. This route is the one
 * honest source they both read.
 *
 * It probes the kernel's unauthenticated /readyz. It used to call
 * /api/v1/ops/status/, which requires a JWT: on the login page there is no
 * session, so that call always 401'd and the badge read "Offline" against a
 * perfectly healthy backend. A status indicator that cannot report "up" is
 * worse than none.
 */
export async function GET() {
  const { reachable, checks } = await getReadiness();

  const database = checks.database ?? null;
  const cache = checks.cache ?? null;

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
