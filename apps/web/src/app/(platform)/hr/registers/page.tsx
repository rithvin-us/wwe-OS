import { FileSpreadsheet } from "@bop/icons";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";

import { getRegisters, getWorkforceSummary, MONTH_NAMES, periodFromParams } from "@/lib/hr";

import { HrNav } from "../hr-nav";
import { PeriodSelector } from "../period-selector";
import { GenerateRegistersButton } from "./generate-button";
import { RegisterHistory } from "./register-history";

export default async function RegistersPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year, month } = periodFromParams(await searchParams);
  const [registers, summary] = await Promise.all([
    getRegisters().catch(() => []),
    getWorkforceSummary(year, month).catch(() => null),
  ]);

  const thisPeriod = (registers || []).filter((log) => log.year === year && log.month === month);
  const payrollReady = (summary?.payroll_generated || 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statutory registers"
        description="Form B, Form XXVI, wage slips and the rest — built from a copy of the company template, fingerprinted, and archived."
        actions={
          <div className="flex items-center gap-2">
            <PeriodSelector year={year} month={month} />
            <GenerateRegistersButton
              year={year}
              month={month}
              payrollReady={payrollReady}
              alreadyGenerated={thisPeriod.length}
            />
          </div>
        }
      />

      <HrNav activeTab="registers" />

      <section className="rounded-lg border border-border bg-card p-4 text-sm shadow-xs">
        <h2 className="mb-2 font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        {!payrollReady ? (
          <p className="text-muted-foreground">
            Payroll has not been run for this month. Registers are built from payroll figures, so
            run payroll first.
          </p>
        ) : thisPeriod.length === 0 ? (
          <p className="text-muted-foreground">
            Not generated yet. Generating produces the workbook, archives it with a fingerprint, and
            locks the month so the figures behind it cannot change afterwards.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Generated {thisPeriod.length} time{thisPeriod.length === 1 ? "" : "s"}. The latest
            version is v{Math.max(...thisPeriod.map((log) => log.version))}. Earlier versions stay
            downloadable — nothing is ever overwritten.
          </p>
        )}
      </section>

      {registers.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No registers generated yet"
          description="Every generated workbook is archived here with its version and fingerprint, so a past submission can be re-downloaded and verified."
        />
      ) : (
        <RegisterHistory registers={registers} />
      )}
    </div>
  );
}
