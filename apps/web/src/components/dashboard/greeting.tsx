"use client";

import { useEffect, useState } from "react";

import { COMPANY } from "@/config/company";

/**
 * Time-aware greeting for the command center. Computed on the client so the
 * time of day and date are correct for the viewer, not the build.
 */
export function Greeting() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
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

  return (
    <div className="space-y-1.5">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{part}</h1>
      <p className="text-sm text-muted-foreground">
        Here&rsquo;s how {COMPANY.name} is doing today.{" "}
        <span className="text-muted-foreground/70 tabular-nums">{dateLabel}</span>
      </p>
    </div>
  );
}
