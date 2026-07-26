"use client";

import { useState, useTransition } from "react";

import { Play } from "@bop/icons";
import { Button } from "@bop/ui/components/button";

import { runPayroll } from "../actions";

/** Re-running a month replaces its figures — that is intended, and is why the
 * button says so rather than pretending the first run is special. */
export function RunPayrollButton({
  year,
  month,
  locked,
}: {
  year: number;
  month: number;
  locked: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await runPayroll(year, month);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={run} disabled={pending || locked}>
        <Play className="mr-1 h-4 w-4" />
        {pending ? "Running…" : "Run payroll"}
      </Button>
      {locked ? (
        <span className="text-xs text-muted-foreground">Locked — registers already submitted</span>
      ) : null}
      {error ? <span className="max-w-xs text-right text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
