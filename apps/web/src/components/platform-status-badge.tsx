"use client";

import { StatusDot, type PlatformStatus } from "@bop/ui/components/status";
import { cn } from "@bop/ui/lib/utils";
import { useEffect, useState } from "react";

type PlatformState = "operational" | "degraded" | "down";

const PRESENTATION: Record<
  PlatformState,
  { status: PlatformStatus; label: string; short: string }
> = {
  operational: { status: "operational", label: "Systems operational", short: "Active" },
  degraded: { status: "attention", label: "Degraded", short: "Degraded" },
  down: { status: "attention", label: "Offline", short: "Offline" },
};

/**
 * Real platform status, resolved on the client.
 *
 * Deliberately not a server component: `djangoFetch` has no timeout, and the
 * backend runs on a plan that cold-starts in tens of seconds. Awaiting it
 * during render would block the login page — the one page that must stay
 * fast — behind a sleeping API. So the page ships static and this badge
 * fills in once the probe answers, showing nothing definite until then.
 */
export function PlatformStatusBadge({
  variant = "full",
  className,
}: {
  variant?: "full" | "short";
  className?: string;
}) {
  const [state, setState] = useState<PlatformState | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/platform-status", { cache: "no-store" });
        const data = (await response.json()) as { state: PlatformState };
        if (active) setState(data.state);
      } catch {
        if (active) setState("down");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const presentation = state ? PRESENTATION[state] : null;

  return (
    <>
      <StatusDot status={presentation?.status ?? "planned"} />
      <span
        className={cn(
          "font-mono font-medium tracking-[0.08em] text-muted-foreground uppercase",
          variant === "full" ? "text-[11px]" : "text-[10px]",
          className,
        )}
      >
        {presentation ? (variant === "full" ? presentation.label : presentation.short) : "Checking"}
      </span>
    </>
  );
}
