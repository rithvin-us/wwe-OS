"use client";

import { useState, useTransition } from "react";

import { Check, Paperclip, X } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";

import type { ExpenseClaim } from "@/lib/hr-constants";

import { decideExpense } from "../actions";

const STATUS_VARIANT = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
} as const;

const inr = (value: number) =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Expense claims. A decision is final: reversing one means a new claim, so the
 * backend refuses a second decision and that refusal is shown here. */
export function ExpenseClaimList({
  claims,
  decidable,
}: {
  claims: ExpenseClaim[];
  decidable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function decide(id: string, status: "approved" | "rejected") {
    setErrors((current) => ({ ...current, [id]: "" }));
    startTransition(async () => {
      const result = await decideExpense(id, status);
      if (!result.ok) {
        setErrors((current) => ({ ...current, [id]: result.error }));
      }
    });
  }

  return (
    <ul className="space-y-2">
      {claims.map((claim) => (
        <li key={claim.id} className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{claim.employee_name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {claim.employee_code}
                </span>
                <Badge variant={STATUS_VARIANT[claim.status]}>{claim.status}</Badge>
                {claim.has_receipt ? (
                  <Badge variant="outline" className="gap-1">
                    <Paperclip className="h-3 w-3" />
                    Receipt
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {claim.category} · {claim.expense_date}
              </p>
              {claim.description ? <p className="mt-1 text-sm">{claim.description}</p> : null}
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="text-lg font-semibold tabular-nums">{inr(claim.amount)}</span>
              {decidable ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => decide(claim.id, "approved")} disabled={pending}>
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => decide(claim.id, "rejected")}
                    disabled={pending}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          {errors[claim.id] ? (
            <p className="mt-2 text-sm text-destructive">{errors[claim.id]}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
