"use client";

import { Bell } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Separator } from "@bop/ui/components/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@bop/ui/components/popover";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  formatRelative,
  type NotificationRecord,
  notificationHref,
} from "@/lib/notifications-constants";

/**
 * The one notification center. Every app publishes into this surface — no app
 * ships its own bell. The dedicated /notifications page is the fuller view of
 * this same system, not a second center.
 */
export function NotificationCenter() {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const data = (await response.json()) as { items: NotificationRecord[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Leave the last-known state; the bell should never break the header.
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        const data = (await response.json()) as { items: NotificationRecord[]; unread: number };
        if (active) {
          setItems(data.items);
          setUnread(data.unread);
        }
      } catch {
        // Keep the last-known state; the bell must never break the header.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function markAll() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    load();
  }

  async function markOne(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    load();
  }

  return (
    <Popover onOpenChange={(open) => open && load()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
          <Bell aria-hidden className="size-4" />
          {unread > 0 ? (
            <span
              aria-label={`${unread} unread`}
              className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-semibold text-white tabular-nums"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 ? (
            <Button variant="ghost" size="xs" onClick={markAll}>
              Mark all read
            </Button>
          ) : null}
        </div>
        <Separator />
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-6 py-8 text-center">
            <Bell aria-hidden className="mb-1 size-5 text-muted-foreground" />
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground">Updates from your apps appear here.</p>
          </div>
        ) : (
          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.map((item) => {
              const href = notificationHref(item);
              const body = (
                <div className="flex items-start gap-2.5 px-4 py-3 text-left">
                  <span
                    aria-hidden
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                      item.status === "unread" ? "bg-primary" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    {item.body ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatRelative(item.created_at)}
                    </p>
                  </div>
                </div>
              );
              return href ? (
                <Link
                  key={item.id}
                  href={href}
                  onClick={() => markOne(item.id)}
                  className="block transition-colors hover:bg-accent"
                >
                  {body}
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markOne(item.id)}
                  className="block w-full transition-colors hover:bg-accent"
                >
                  {body}
                </button>
              );
            })}
          </div>
        )}
        <Separator />
        <div className="p-2">
          <Button variant="ghost" size="sm" asChild className="w-full">
            <Link href="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
