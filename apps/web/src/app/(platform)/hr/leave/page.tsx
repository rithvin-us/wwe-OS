import { CalendarDays } from "@bop/icons";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";

import { currentPeriod, getLeaveBalances, getLeaveRequests } from "@/lib/hr";

import { LeaveBalanceTable } from "./leave-balances";
import { LeaveRequestList } from "./leave-requests";

export default async function LeavePage() {
  const { year } = currentPeriod();
  const [requests, balances] = await Promise.all([getLeaveRequests(), getLeaveBalances(year)]);

  const pending = requests.filter((request) => request.status === "pending");
  const decided = requests.filter((request) => request.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave"
        description="Requests come in from employees; you only handle the decision. Approving deducts from the balance for the year the leave starts in."
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Awaiting your decision
          {pending.length > 0 ? ` (${pending.length})` : ""}
        </h2>
        {pending.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No leave requests waiting"
            description="New requests appear here as soon as they are raised."
          />
        ) : (
          <LeaveRequestList requests={pending} decidable />
        )}
      </section>

      {decided.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Recently decided</h2>
          <LeaveRequestList requests={decided.slice(0, 20)} decidable={false} />
        </section>
      ) : null}

      {balances.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Balances for {year}</h2>
          <LeaveBalanceTable balances={balances} />
        </section>
      ) : null}
    </div>
  );
}
