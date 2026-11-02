"use client";

import { useEffect, useState } from "react";

import { formatRelative } from "@/config/dashboard";

/**
 * The dashboard's readout line: the viewer's own date, and when the figures
 * below it were actually fetched. Computed on the client because the server
 * cannot know the viewer's clock.
 *
 * `dataAsOf` is when the server fetched the dashboard's figures — a surface
 * meant to carry real decisions has to say how fresh what it shows is.
 */
export function DashboardClock({ dataAsOf }: { dataAsOf: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Client's clock only — the server can't know it, so this is a real
    // external-system read, not derived state the effect could avoid.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the viewer's clock, which the server cannot know; doing it during render would hydrate mismatched
    setNow(new Date());

    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (now === null) {
    // Reserve the line's height so the header never shifts when the clock
    // resolves on the client.
    return <p className="font-mono text-xs text-muted-foreground">&nbsp;</p>;
  }

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <p className="animate-in fade-in font-mono text-xs text-muted-foreground tabular-nums duration-(--duration-base) ease-out-quart">
      {dateLabel}
      <span className="text-muted-foreground-subtle"> · updated {formatRelative(dataAsOf)}</span>
    </p>
  );
}
