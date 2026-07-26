"use client";

import { useState, useTransition } from "react";

import { FileSpreadsheet } from "@bop/icons";
import { Button } from "@bop/ui/components/button";

import { generateRegisters } from "../actions";

/**
 * Generating is consequential: it archives a submission-grade workbook and
 * locks the month. When a month has already been generated, the button says so
 * and asks for confirmation, because a second run is a new version, not a
 * correction of the first.
 */
export function GenerateRegistersButton({
  year,
  month,
  payrollReady,
  alreadyGenerated,
}: {
  year: number;
  month: number;
  payrollReady: boolean;
  alreadyGenerated: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function generate() {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const result = await generateRegisters(year, month);
      if (!result.ok) setError(result.error);
    });
  }

  const nextVersion = alreadyGenerated + 1;

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Create version {nextVersion}?</span>
          <Button size="sm" onClick={generate} disabled={pending}>
            Yes, generate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          onClick={() => (alreadyGenerated > 0 ? setConfirming(true) : generate())}
          disabled={pending || !payrollReady}
        >
          <FileSpreadsheet className="mr-1 h-4 w-4" />
          {pending
            ? "Generating…"
            : alreadyGenerated > 0
              ? `Generate v${nextVersion}`
              : "Generate workbook"}
        </Button>
      )}
      {!payrollReady ? (
        <span className="text-xs text-muted-foreground">Run payroll first</span>
      ) : null}
      {error ? <span className="max-w-xs text-right text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
