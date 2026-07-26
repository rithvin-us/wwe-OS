import type { PayrollRow } from "@/lib/hr";

const inr = (value: number) =>
  value === 0
    ? "—"
    : value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A month's payroll, one row per employee. Names come from the employee master
 * through the relationship, so a rename shows up here too. */
export function PayrollTable({ records }: { records: PayrollRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Code</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 text-right font-medium">Paid days</th>
            <th className="px-3 py-2 text-right font-medium">OT hrs</th>
            <th className="px-3 py-2 text-right font-medium">Basic</th>
            <th className="px-3 py-2 text-right font-medium">Gross</th>
            <th className="px-3 py-2 text-right font-medium">PF</th>
            <th className="px-3 py-2 text-right font-medium">ESI</th>
            <th className="px-3 py-2 text-right font-medium">Advances</th>
            <th className="px-3 py-2 text-right font-medium">Reimbursed</th>
            <th className="px-3 py-2 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => (
            <tr key={row.id} className="border-t border-border/60 hover:bg-accent/50">
              <td className="px-3 py-2 font-mono text-xs">{row.employee_code}</td>
              <td className="px-3 py-2 font-medium">{row.employee_name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.total_paid_days}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.ot_hours > 0 ? row.ot_hours : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{inr(row.basic_earned)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {inr(row.gross_salary)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{inr(row.pf_deduction)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{inr(row.esi_deduction)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {inr(row.advance_deduction + row.damage_deduction + row.other_deductions)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {inr(row.expense_reimbursement)}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {inr(row.net_salary)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
