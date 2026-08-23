import type { Metadata } from "next";
import { MinusCircle } from "@bop/icons";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";

import { getDeductions, getEmployees, periodFromParams } from "@/lib/hr";
import { HrNav } from "../hr-nav";
import { PeriodSelector } from "../period-selector";

import { AddDeductionDialog } from "./add-deduction-dialog";

interface DeductionRecord {
  id: string;
  employee_name?: string;
  employee_code?: string;
  employee?: string;
  type: string;
  amount: number | string;
  notes?: string;
  created_at?: string;
}

export const metadata: Metadata = {
  title: "Deductions",
};

export default async function DeductionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year, month } = periodFromParams(await searchParams);

  const [fetchedDeductions, fetchedEmployees] = await Promise.all([
    getDeductions(year, month).catch(() => []),
    getEmployees().catch(() => []),
  ]);

  const deductions = fetchedDeductions as unknown as DeductionRecord[];

  const employees = fetchedEmployees.map((e) => ({
    id: e.id,
    employee_code: e.employee_code,
    employee_name: e.employee_name,
  }));

  const totalDeductions = deductions.reduce(
    (acc: number, d: DeductionRecord) => acc + (parseFloat(String(d.amount)) || 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deductions"
        description="Salary advances, fines, damage claims, and loan repayments recorded for Form B statutory registers."
        actions={
          <div className="flex items-center gap-3">
            <PeriodSelector year={year} month={month} />
            <AddDeductionDialog employees={employees} year={year} month={month} />
          </div>
        }
      />

      <HrNav activeTab="deductions" />

      {deductions.length === 0 ? (
        <EmptyState
          icon={MinusCircle}
          title="No deductions for this period"
          description="Record salary advances, fines, damage deductions, or loan repayments for Form B compliance."
          action={<AddDeductionDialog employees={employees} year={year} month={month} />}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-card p-3 rounded-lg border border-border">
            <span>
              Total records: <strong className="text-foreground">{deductions.length}</strong>
            </span>
            <span>
              Total Deducted:{" "}
              <strong className="text-blue-600 dark:text-blue-400 font-mono text-sm">
                ₹{totalDeductions.toLocaleString("en-IN")}
              </strong>
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/50 text-muted-foreground font-mono uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deductions.map((d: DeductionRecord) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {d.employee_name || d.employee_code || d.employee}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {d.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">
                      ₹{parseFloat(String(d.amount)).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.notes || "—"}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-[11px]">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
