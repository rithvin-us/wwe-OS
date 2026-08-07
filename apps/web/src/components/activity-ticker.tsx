"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio } from "@bop/icons";

import {
  formatRelative,
  notificationHref,
  type NotificationRecord,
} from "@/lib/notifications-constants";

const POLL_MS = 20_000;

/**
 * Ambient "the company is alive" pointer — the freshest event, always
 * linking into an existing surface (its own href, or the Business Timeline).
 * Read-only: no unread count, no mark-as-read, no popover — that state lives
 * in NotificationCenter alone, so this never becomes a second bell.
 */
export function ActivityTicker() {
  const [latest, setLatest] = useState<NotificationRecord | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        const data = (await response.json()) as { items: NotificationRecord[] };
        if (active) setLatest(data.items?.[0] ?? null);
      } catch {
        // Stay on the last-known event; the ticker never breaks the header.
      }
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!latest) return null;

  return (
    <Link
      href={notificationHref(latest) ?? "/timeline"}
      className="hidden min-w-0 max-w-[15rem] items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none xl:flex"
    >
      <span className="relative flex size-1.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-success" />
      </span>
      <span className="truncate text-muted-foreground">
        <span className="font-medium text-foreground">{latest.title}</span>
        {" · "}
        {formatRelative(latest.created_at)}
      </span>
      <Radio aria-hidden className="size-3 shrink-0 text-muted-foreground" />
    </Link>
  );
}
