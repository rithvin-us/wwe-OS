import type { LeaveBalance } from "@/lib/hr";

/** Leave balances by employee. `remaining` is computed by the backend from
 * allocated minus used, so the three figures can never disagree. */
export function LeaveBalanceTable({ balances }: { balances: LeaveBalance[] }) {
  const byEmployee = new Map<string, LeaveBalance[]>();
  for (const balance of balances) {
    const key = balance.employee;
    byEmployee.set(key, [...(byEmployee.get(key) ?? []), balance]);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Employee</th>
            <th className="px-3 py-2 font-medium">Leave type</th>
            <th className="px-3 py-2 text-right font-medium">Allocated</th>
            <th className="px-3 py-2 text-right font-medium">Used</th>
            <th className="px-3 py-2 text-right font-medium">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {[...byEmployee.values()].flatMap((rows) =>
            rows.map((balance, index) => (
              <tr key={balance.id} className="border-t border-border/60">
                <td className="px-3 py-2">
                  {index === 0 ? (
                    <>
                      <span className="font-medium">{balance.employee_name}</span>{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {balance.employee_code}
                      </span>
                    </>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{balance.leave_type_name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{balance.allocated}</td>
                <td className="px-3 py-2 text-right tabular-nums">{balance.used}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {balance.remaining}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
