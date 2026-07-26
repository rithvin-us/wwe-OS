"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { ChevronLeft, ChevronRight } from "@bop/icons";
import { Button } from "@bop/ui/components/button";

import { MONTH_NAMES } from "@/lib/hr-constants";

/**
 * The month every HR screen is scoped to. The whole HR cycle is monthly —
 * attendance, payroll, registers — so the period lives in the URL and one
 * control moves all of them.
 */
export function PeriodSelector({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function go(nextYear: number, nextMonth: number) {
    const next = new URLSearchParams(params.toString());
    next.set("year", String(nextYear));
    next.set("month", String(nextMonth));
    startTransition(() => router.push(`?${next.toString()}`));
  }

  function shift(delta: number) {
    const zeroBased = month - 1 + delta;
    const nextYear = year + Math.floor(zeroBased / 12);
    const nextMonth = (((zeroBased % 12) + 12) % 12) + 1;
    go(nextYear, nextMonth);
  }

  return (
    <div className="flex items-center gap-1" aria-busy={pending}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => shift(-1)}
        aria-label="Previous month"
        disabled={pending}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[10rem] text-center text-sm font-medium tabular-nums">
        {MONTH_NAMES[month - 1]} {year}
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => shift(1)}
        aria-label="Next month"
        disabled={pending}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
