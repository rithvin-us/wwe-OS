"use client";

import { Archive, Bell, Check } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { EmptyState } from "@bop/ui/components/empty-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  markAllReadAction,
  markArchivedAction,
  markReadAction,
} from "@/app/(platform)/notifications/actions";
import {
  formatRelative,
  type NotificationRecord,
  type NotificationStatus,
  notificationHref,
} from "@/lib/notifications-constants";

type Filter = "all" | "unread" | NotificationStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "archived", label: "Archived" },
];

function match(item: NotificationRecord, filter: Filter): boolean {
  if (filter === "all") return item.status !== "archived";
  return item.status === filter;
}

function Row({
  item,
  onRead,
  onArchive,
  pending,
}: {
  item: NotificationRecord;
  onRead: (id: string) => void;
  onArchive: (id: string) => void;
  pending: boolean;
}) {
  const href = notificationHref(item);
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <span
        aria-hidden
        className={`mt-1.5 size-2 shrink-0 rounded-full ${
          item.status === "unread" ? "bg-primary" : "bg-transparent"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {href ? (
            <Link
              href={href}
              className="font-medium text-foreground transition-colors hover:text-primary"
            >
              {item.title}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.title}</span>
          )}
          {item.priority === "high" || item.priority === "urgent" ? (
            <Badge variant="warning" className="capitalize">
              {item.priority}
            </Badge>
          ) : null}
        </div>
        {item.body ? <p className="text-sm text-muted-foreground">{item.body}</p> : null}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.category} · {formatRelative(item.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.status === "unread" ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Mark read"
            disabled={pending}
            onClick={() => onRead(item.id)}
          >
            <Check aria-hidden />
          </Button>
        ) : null}
        {item.status !== "archived" ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Archive"
            disabled={pending}
            onClick={() => onArchive(item.id)}
          >
            <Archive aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationsList({ notifications }: { notifications: NotificationRecord[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const rows = notifications.filter((item) => match(item, filter));
  const hasUnread = notifications.some((item) => item.status === "unread");

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={filter === option.value ? "secondary" : "ghost"}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {hasUnread ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(markAllReadAction)}
          >
            <Check aria-hidden />
            Mark all read
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing here"
          description="Notifications from across the platform show up here."
        />
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((item) => (
            <Row
              key={item.id}
              item={item}
              pending={pending}
              onRead={(id) => run(() => markReadAction(id))}
              onArchive={(id) => run(() => markArchivedAction(id))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
