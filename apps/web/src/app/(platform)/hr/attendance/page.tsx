import { CalendarCheck, Lock } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";

import { getAttendanceGrid, getWorkforceSummary, periodFromParams } from "@/lib/hr";
import { HrNav } from "../hr-nav";
import { PeriodSelector } from "../period-selector";
import { AttendanceGridEditor } from "./attendance-grid";

import { FaceKioskDialog } from "./face-kiosk-dialog";
import { ShareCheckInLinkButton } from "./share-link-button";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year, month } = periodFromParams(await searchParams);
  const [grid, summary] = await Promise.all([
    getAttendanceGrid(year, month),
    getWorkforceSummary(year, month),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="One row per employee, one column per day. Present days are given the shift's standard timings automatically."
        actions={
          <div className="flex items-center gap-2">
            <ShareCheckInLinkButton />
            <FaceKioskDialog />
            {summary.period_locked ? (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                Locked
              </Badge>
            ) : null}
            <PeriodSelector year={year} month={month} />
          </div>
        }
      />

      <HrNav activeTab="attendance" />

      {grid.rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nobody was on the rolls this month"
          description="Add employees to the master, or pick a different month."
        />
      ) : (
        <AttendanceGridEditor grid={grid} locked={summary.period_locked} />
      )}
    </div>
  );
}
