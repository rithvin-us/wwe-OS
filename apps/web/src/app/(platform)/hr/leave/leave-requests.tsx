"use client";

import { useState, useTransition } from "react";

import { Check, X } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";

import type { LeaveRequest } from "@/lib/hr-constants";

import { decideLeave } from "../actions";

const STATUS_VARIANT = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
} as const;

/** Leave requests. Approval can be refused by the backend when the balance
 * cannot cover the request — that message is surfaced verbatim rather than
 * being flattened into "something went wrong". */
export function LeaveRequestList({
  requests,
  decidable,
}: {
  requests: LeaveRequest[];
  decidable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function decide(id: string, status: "approved" | "rejected") {
    setErrors((current) => ({ ...current, [id]: "" }));
    startTransition(async () => {
      const result = await decideLeave(id, status);
      if (!result.ok) {
        setErrors((current) => ({ ...current, [id]: result.error }));
      }
    });
  }

  return (
    <ul className="space-y-2">
      {requests.map((request) => (
        <li key={request.id} className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{request.employee_name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {request.employee_code}
                </span>
                <Badge variant={STATUS_VARIANT[request.status]}>{request.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {request.leave_type_name} · {request.start_date} to {request.end_date} ·{" "}
                {request.days} day{request.days === 1 ? "" : "s"}
              </p>
              {request.reason ? <p className="mt-1 text-sm">{request.reason}</p> : null}
              {request.decision_note ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {request.decided_by_name}: {request.decision_note}
                </p>
              ) : null}
            </div>

            {decidable ? (
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" onClick={() => decide(request.id, "approved")} disabled={pending}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => decide(request.id, "rejected")}
                  disabled={pending}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Reject
                </Button>
              </div>
            ) : null}
          </div>

          {errors[request.id] ? (
            <p className="mt-2 text-sm text-destructive">{errors[request.id]}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
