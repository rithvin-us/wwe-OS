"use client";

import { ScrollArea } from "@bop/ui/components/scroll-area";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { COMPANY } from "@/config/company";
import { NAVIGATION } from "@/config/navigation";

interface NavBadges {
  purchase: number;
  automation: number;
}

type PlatformState = "operational" | "degraded" | "down";

/** Footer indicator copy + dot colour per real backend state. Never
 * optimistic: until the first probe resolves the state is unknown, and an
 * unreachable kernel reads as "Offline", not "Connected". */
const STATUS_PRESENTATION: Record<PlatformState, { label: string; dot: string }> = {
  operational: { label: "Connected", dot: "bg-success" },
  degraded: { label: "Degraded", dot: "bg-warning" },
  down: { label: "Offline", dot: "bg-destructive" },
};

/** Nav item name -> badge count key. Only areas with a real wired count get
 * one — no guessed numbers for modules without a backend source yet. */
const BADGE_BY_NAME: Record<string, keyof NavBadges> = {
  Purchases: "purchase",
  Automation: "automation",
};

/**
 * The one sidebar. Rendered once in the desktop rail and once inside the
 * mobile sheet — never duplicated, never restyled per module.
 * Supports a `collapsed` prop for icon-only rail mode.
 */
export function AppSidebar({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<NavBadges | null>(null);
  const [platformState, setPlatformState] = useState<PlatformState | null>(null);

  useEffect(() => {
    let active = true;
    const probe = async () => {
      try {
        const response = await fetch("/api/platform-status", { cache: "no-store" });
        const data = (await response.json()) as { state: PlatformState };
        if (active) setPlatformState(data.state);
      } catch {
        // The probe itself failing is indistinguishable from the kernel being
        // unreachable, so report it as down rather than leaving a stale dot.
        if (active) setPlatformState("down");
      }
    };
    void probe();
    const timer = setInterval(probe, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/nav-badges", { cache: "no-store" });
        const data = (await response.json()) as NavBadges;
        if (active) setBadges(data);
      } catch {
        // Sidebar renders fine without badges; never block navigation on this.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className="flex h-full flex-col bg-sidebar text-sidebar-foreground"
      style={{ minWidth: collapsed ? "4rem" : "var(--layout-sidebar-width)" }}
    >
      <Link
        href="/"
        onClick={onNavigate}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          height: "calc(var(--layout-header-height) + env(safe-area-inset-top))",
        }}
        className={cn(
          "flex shrink-0 items-center gap-3 border-b border-sidebar-border focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50 focus-visible:outline-none",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary font-display text-xs font-semibold text-sidebar-primary-foreground">
          {COMPANY.mark}
        </span>
        {!collapsed && (
          <span className="block min-w-0 truncate font-display text-sm font-semibold tracking-tight text-foreground">
            {COMPANY.name}
          </span>
        )}
      </Link>

      <ScrollArea className="min-h-0 flex-1">
        <nav
          aria-label="Platform"
          className={cn("flex flex-col gap-6 py-4", collapsed ? "px-2" : "px-3")}
        >
          {NAVIGATION.map((group, index) => (
            <div key={group.label ?? `group-${index}`} className="flex flex-col gap-1">
              {group.label && !collapsed ? (
                <p className="px-3 pb-2 text-xs text-muted-foreground">{group.label}</p>
              ) : null}
              {group.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badgeKey = BADGE_BY_NAME[item.name];
                const badgeCount = badgeKey ? (badges?.[badgeKey] ?? 0) : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.name : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      // One row height and one icon column for every entry,
                      // active or not — the left rail is drawn on a border
                      // that is always there, so nothing shifts on selection.
                      "relative flex h-9 items-center rounded-md border-l-2 text-sm transition-colors duration-(--duration-fast)",
                      "focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50 focus-visible:outline-none",
                      collapsed ? "justify-center px-0" : "gap-3 pr-3 pl-2.5",
                      active
                        ? "border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : cn(
                            "border-transparent hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                            item.subtle ? "text-muted-foreground" : "text-sidebar-foreground",
                          ),
                    )}
                  >
                    <item.icon
                      aria-hidden
                      className={cn(
                        "shrink-0",
                        collapsed ? "size-5" : "size-4",
                        active ? "text-sidebar-primary" : "text-muted-foreground",
                      )}
                    />
                    {collapsed ? (
                      badgeCount > 0 && (
                        <span
                          aria-hidden
                          className="absolute top-1.5 right-1.5 size-1.5 bg-sidebar-primary"
                        />
                      )
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        {badgeCount > 0 && (
                          <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Platform status footer. Reflects a real probe of the kernel — while
          the first probe is in flight nothing is asserted. */}
      <div className={cn("border-t border-sidebar-border", collapsed ? "p-3" : "px-4 py-3")}>
        {(() => {
          const presentation = platformState ? STATUS_PRESENTATION[platformState] : null;
          const dot = (
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0",
                presentation ? presentation.dot : "bg-muted-foreground/40",
              )}
            />
          );

          if (collapsed) {
            return (
              <div className="flex justify-center" title={presentation?.label ?? "Checking"}>
                {dot}
                <span className="sr-only">{presentation?.label ?? "Checking connection"}</span>
              </div>
            );
          }

          return (
            <div className="flex items-center justify-between gap-3 font-mono text-xs">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                {dot}
                <span className="truncate">{COMPANY.name}</span>
              </span>
              <span className="shrink-0 text-muted-foreground-subtle">
                {presentation?.label ?? "Checking"}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
