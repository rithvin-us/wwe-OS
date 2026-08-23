import { NextResponse, type NextRequest } from "next/server";
import { getTimeline } from "@/lib/audit";
import { type TimelineModule } from "@/lib/audit-helpers";

/**
 * Activity timeline.
 *
 * This route used to carry ~150 lines of fabricated "fallback demonstration"
 * entries — invoice numbers, payroll payouts, named vendors — that it served
 * whenever the real query came back empty OR threw. An empty database is the
 * normal state of a fresh install, so the fake path was the usual one, and it
 * was indistinguishable on screen from real activity.
 *
 * An empty timeline now reports itself as empty, and a failed query reports
 * itself as failed.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const moduleParam = searchParams.get("module") || undefined;
  const dateFrom = searchParams.get("date_from") || undefined;
  const dateTo = searchParams.get("date_to") || undefined;
  const vendor = searchParams.get("vendor") || undefined;
  const page = Math.max(Number(searchParams.get("page")) || 1, 1);

  try {
    const data = await getTimeline({
      module: moduleParam as TimelineModule | undefined,
      dateFrom,
      dateTo,
      vendor,
      page,
    });

    // Returned as-is, including zero entries. The client renders an empty
    // state; it must never be handed invented activity to fill the gap.
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[api/timeline] failed to load audit timeline", error);
    return NextResponse.json(
      { success: false, error: "Could not load activity. Check the platform connection." },
      { status: 502 },
    );
  }
}
