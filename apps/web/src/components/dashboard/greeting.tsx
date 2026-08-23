"use client";

import { useEffect, useState } from "react";

import { COMPANY } from "@/config/company";
import { formatRelative } from "@/config/dashboard";

/**
 * Time-aware greeting for the command center. Computed on the client so the
 * time of day and date are correct for the viewer, not the build.
 *
 * `dataAsOf` is when the server actually fetched the dashboard's figures —
 * a surface the operator is meant to trust for real decisions needs to say
 * how fresh what it's showing is, not just what day it is.
 */
export function Greeting({ dataAsOf, name = "LAKSHMANAN" }: { dataAsOf: string; name?: string }) {
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

  const part =
    now === null
      ? "Welcome back"
      : now.getHours() < 12
        ? "Good morning"
        : now.getHours() < 18
          ? "Good afternoon"
          : "Good evening";

  const dateLabel = now
    ? now.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : " ";

  const updatedLabel = now ? formatRelative(dataAsOf) : null;

  return (
    // Keyed on the loading -> resolved boundary so the swap from the
    // server-rendered "Welcome back" placeholder to the real time-aware
    // greeting is a confirmed crossfade, not a silent content jump —
    // same keyed-remount + CSS approach as app-shell.tsx's route fade.
    <div
      key={now === null ? "loading" : "ready"}
      className="animate-in fade-in space-y-1.5 duration-(--duration-base) ease-out-quart"
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        {part}, {name}
      </h1>
      <p className="text-sm text-muted-foreground">
        Here&rsquo;s how {COMPANY.name} is doing today.{" "}
        <span className="text-muted-foreground-subtle tabular-nums">{dateLabel}</span>
        {updatedLabel ? (
          <span className="text-muted-foreground-subtle"> · Updated {updatedLabel}</span>
        ) : null}
      </p>
    </div>
  );
}
