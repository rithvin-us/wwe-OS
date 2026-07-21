"use client";

import { Button } from "@bop/ui/components/button";

export default function ReportsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">Couldn&apos;t load reports</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Something went wrong reaching the platform. Check your connection and try again.
      </p>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
