import { IndianRupee } from "@bop/icons";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";

import { getPayroll, getWorkforceSummary, periodFromParams } from "@/lib/hr";

import { PeriodSelector } from "../period-selector";
import { StatTile } from "../stat-tile";
import { PayrollTable } from "./payroll-table";
import { RunPayrollButton } from "./run-payroll-button";

const inr = (value: number) =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year, month } = periodFromParams(await searchParams);
  const [payroll, summary] = await Promise.all([
    getPayroll(year, month),
    getWorkforceSummary(year, month),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Paid days are pro-rated over the standard month, overtime is the sum of each day's stored OT, and PF, ESI and recorded advances are deducted."
        actions={
          <div className="flex items-center gap-2">
            <PeriodSelector year={year} month={month} />
            <RunPayrollButton year={year} month={month} locked={summary.period_locked} />
          </div>
        }
      />

      {payroll.records.length === 0 ? (
        <EmptyState
          icon={IndianRupee}
          title="Payroll has not been run for this month"
          description="Fill in the attendance grid first, then run payroll. Employees with no salary structure are skipped."
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Employees paid" value={payroll.total_employees} icon={IndianRupee} />
            <StatTile label="Gross" value={inr(payroll.total_gross)} icon={IndianRupee} />
            <StatTile
              label="Deductions"
              value={inr(payroll.total_deductions)}
              hint={`PF ${inr(payroll.total_pf)} · ESI ${inr(payroll.total_esi)}`}
              icon={IndianRupee}
            />
            <StatTile label="Net payable" value={inr(payroll.total_net)} icon={IndianRupee} />
          </section>

          <PayrollTable records={payroll.records} />
        </>
      )}
    </div>
  );
}
