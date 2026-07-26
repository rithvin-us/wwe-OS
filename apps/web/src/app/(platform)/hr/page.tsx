import Link from "next/link";

import {
  AlertTriangle,
  CalendarCheck,
  FileSpreadsheet,
  IndianRupee,
  Lock,
  ShieldCheck,
  Users,
} from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";

import {
  getAnomalies,
  getWorkforceSummary,
  MONTH_NAMES,
  periodFromParams,
  type AnomalyReport,
  type WorkforceSummary,
} from "@/lib/hr";

import { HrCharts } from "./hr-charts";
import { HrComplianceGauges } from "./hr-compliance-gauges";
import { HrNav } from "./hr-nav";
import { PeriodSelector } from "./period-selector";
import { StatTile } from "./stat-tile";

const SEVERITY_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year, month } = periodFromParams(await searchParams);
  const defaultSummary: WorkforceSummary = {
    year,
    month,
    total_employees: 0,
    active_employees: 0,
    left_employees: 0,
    new_joiners: 0,
    leavers_this_month: 0,
    present_units: 0,
    absent_days: 0,
    leave_days: 0,
    holiday_off_days: 0,
    working_units: 0,
    attendance_pct: 0,
    leave_pct: 0,
    absent_pct: 0,
    total_ot_hours: 0,
    avg_ot_per_active: 0,
    payroll_generated: 0,
    payroll_eligible: 0,
    payroll_readiness_pct: 0,
    period_locked: false,
    departments: [],
    shifts: [],
    compliance: {
      active: 0,
      missing_pf: 0,
      missing_esic: 0,
      missing_uan: 0,
      not_face_enrolled: 0,
      compliant_pct: 0,
    },
    anomaly_count: 0,
  };

  const defaultAnomalyReport: AnomalyReport = {
    year,
    month,
    total: 0,
    by_type: {},
    anomalies: [],
  };

  let summary = defaultSummary;
  let anomalyReport = defaultAnomalyReport;

  try {
    const [fetchedSummary, fetchedAnomalies] = await Promise.all([
      getWorkforceSummary(year, month),
      getAnomalies(year, month),
    ]);
    summary = fetchedSummary || defaultSummary;
    anomalyReport = fetchedAnomalies || defaultAnomalyReport;
  } catch (err) {
    console.error("HR Page data fetch error:", err);
  }

  const period = `${MONTH_NAMES[month - 1]} ${year}`;
  const payrollDone =
    summary.payroll_eligible > 0 && summary.payroll_generated >= summary.payroll_eligible;

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR"
        description="Employees, attendance, payroll, and statutory registers."
        actions={<PeriodSelector year={year} month={month} />}
      />

      <HrNav activeTab="overview" />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="On the rolls"
          value={summary.active_employees}
          hint={summary.new_joiners > 0 ? `+${summary.new_joiners} joined` : undefined}
          icon={Users}
        />
        <StatTile
          label="Attendance"
          value={summary.working_units > 0 ? `${summary.attendance_pct}%` : "—"}
          hint={
            summary.working_units > 0
              ? `${summary.present_units} of ${summary.working_units} days`
              : "No attendance yet"
          }
          icon={CalendarCheck}
        />
        <StatTile
          label="Overtime"
          value={summary.total_ot_hours > 0 ? `${summary.total_ot_hours}h` : "—"}
          hint={summary.total_ot_hours > 0 ? `${summary.avg_ot_per_active}h avg` : undefined}
          icon={IndianRupee}
        />
        <StatTile
          label="Needs attention"
          value={anomalyReport.total}
          hint={anomalyReport.total === 0 ? "All clear" : undefined}
          icon={AlertTriangle}
        />
      </section>

      {/* HR Analytics & Workforce Charts */}
      <HrCharts />

      {/* The monthly cycle, in the order it must be done. */}
      <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">The {period} cycle</h2>
          {summary.period_locked ? (
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" />
              Locked — registers submitted
            </Badge>
          ) : null}
        </div>

        <ol className="grid gap-3 md:grid-cols-4">
          <CycleStep
            step={1}
            title="Employee master"
            href="/hr/employees"
            state={summary.active_employees > 0 ? "done" : "todo"}
            detail={
              summary.active_employees > 0
                ? `${summary.active_employees} on the rolls`
                : "Add your first employee"
            }
          />
          <CycleStep
            step={2}
            title="Attendance"
            href={`/hr/attendance?year=${year}&month=${month}`}
            state={summary.working_units > 0 ? "done" : "todo"}
            detail={
              summary.working_units > 0
                ? `${summary.working_units} days recorded`
                : "Nothing recorded yet"
            }
          />
          <CycleStep
            step={3}
            title="Run payroll"
            href={`/hr/payroll?year=${year}&month=${month}`}
            state={payrollDone ? "done" : summary.payroll_generated > 0 ? "partial" : "todo"}
            detail={
              summary.payroll_eligible > 0
                ? `${summary.payroll_generated} of ${summary.payroll_eligible} employees`
                : "No employees to pay"
            }
          />
          <CycleStep
            step={4}
            title="Generate registers"
            href={`/hr/registers?year=${year}&month=${month}`}
            state={summary.period_locked ? "done" : "todo"}
            detail={summary.period_locked ? "Submitted and locked" : "Not generated"}
          />
        </ol>
      </section>

      {/* Statutory Circular Progress Gauges */}
      <HrComplianceGauges />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Statutory compliance — the thing an inspector asks about. */}
        <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Statutory details</h2>
          </div>
          {summary.compliance.active === 0 ? (
            <p className="text-sm text-muted-foreground">No employees on the rolls yet.</p>
          ) : (
            <dl className="space-y-2 text-sm">
              <ComplianceRow
                label="Complete records"
                value={`${summary.compliance.compliant_pct}%`}
              />
              <ComplianceRow label="Missing PF number" value={summary.compliance.missing_pf} />
              <ComplianceRow label="Missing UAN" value={summary.compliance.missing_uan} />
              <ComplianceRow label="Missing ESIC number" value={summary.compliance.missing_esic} />
              <ComplianceRow
                label="Not enrolled for photo check-in"
                value={summary.compliance.not_face_enrolled}
              />
            </dl>
          )}
        </section>

        {/* What needs a human look. */}
        <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Needs your attention</h2>
          </div>
          {anomalyReport.anomalies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing flagged for {period}.</p>
          ) : (
            <ul className="space-y-2">
              {anomalyReport.anomalies.slice(0, 6).map((anomaly, index) => (
                <li
                  key={`${anomaly.type}-${anomaly.employee_code}-${anomaly.day}-${index}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {anomaly.employee_name ?? "Unidentified"}
                    </p>
                    <p className="text-xs text-muted-foreground">{anomaly.detail}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {SEVERITY_TONE[anomaly.severity] === "danger" ? "High" : anomaly.severity}
                  </Badge>
                </li>
              ))}
              {anomalyReport.anomalies.length > 6 ? (
                <li className="pt-1 text-xs text-muted-foreground">
                  and {anomalyReport.anomalies.length - 6} more
                </li>
              ) : null}
            </ul>
          )}
        </section>
      </div>

      {summary.departments.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No attendance for this month yet"
          description="Fill in the attendance grid, then run payroll and generate the registers."
        />
      ) : (
        <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <h2 className="mb-3 text-sm font-semibold">By department</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Department</th>
                  <th className="pb-2 text-right font-medium">Headcount</th>
                  <th className="pb-2 text-right font-medium">Attendance</th>
                  <th className="pb-2 text-right font-medium">Overtime</th>
                </tr>
              </thead>
              <tbody>
                {summary.departments.map((dept) => (
                  <tr key={dept.department} className="border-b border-border/50 last:border-0">
                    <td className="py-2">{dept.department}</td>
                    <td className="py-2 text-right tabular-nums">{dept.headcount}</td>
                    <td className="py-2 text-right tabular-nums">
                      {dept.working_units > 0 ? `${dept.attendance_pct}%` : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {dept.ot_hours > 0 ? `${dept.ot_hours}h` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function ComplianceRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function CycleStep({
  step,
  title,
  href,
  state,
  detail,
}: {
  step: number;
  title: string;
  href: string;
  state: "done" | "partial" | "todo";
  detail: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-1 rounded-md border border-border p-3 transition-colors hover:bg-accent"
      >
        <div className="flex items-center gap-2">
          <span
            className={
              state === "done"
                ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
                : "flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-muted-foreground"
            }
          >
            {step}
          </span>
          <span className="text-sm font-medium">{title}</span>
        </div>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </Link>
    </li>
  );
}
