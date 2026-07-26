import { Receipt } from "@bop/icons";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";

import { getExpenseClaims } from "@/lib/hr";
import { HrNav } from "../hr-nav";

import { ExpenseClaimList } from "./expense-claims";

export default async function ExpensesPage() {
  const claims = await getExpenseClaims().catch(() => []);

  const pending = claims.filter((claim) => claim.status === "pending");
  const decided = claims.filter((claim) => claim.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense claims"
        description="An approved claim is reimbursed with that month's salary, after deductions — it never enters gross, so PF and ESI are unaffected."
      />

      <HrNav activeTab="expenses" />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Awaiting your decision
          {pending.length > 0 ? ` (${pending.length})` : ""}
        </h2>
        {pending.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No claims waiting"
            description="Claims raised by employees appear here for approval."
          />
        ) : (
          <ExpenseClaimList claims={pending} decidable />
        )}
      </section>

      {decided.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Recently decided</h2>
          <ExpenseClaimList claims={decided.slice(0, 20)} decidable={false} />
        </section>
      ) : null}
    </div>
  );
}
