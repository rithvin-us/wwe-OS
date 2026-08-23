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
  operational: { label: "Connected", dot: "bg-blue-500" },
  degraded: { label: "Degraded", dot: "bg-amber-500" },
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
          "flex shrink-0 items-center gap-2.5 border-b border-sidebar-border focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50 focus-visible:outline-none",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600 font-display text-[11px] font-bold text-white shadow-xs shrink-0">
          {COMPANY.mark}
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate font-display text-[13px] font-bold tracking-tight text-foreground">
              {COMPANY.name}
            </span>
          </span>
        )}
      </Link>

      <ScrollArea className="min-h-0 flex-1">
        <nav
          aria-label="Platform"
          className={cn("flex flex-col gap-5 py-4", collapsed ? "px-1.5" : "px-3")}
        >
          {NAVIGATION.map((group, index) => (
            <div key={group.label ?? `group-${index}`} className="flex flex-col gap-1">
              {group.label && !collapsed ? (
                <p className="px-2.5 pb-1 font-mono text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                  {group.label}
                </p>
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
                      "relative flex items-center rounded-lg text-[13px] font-medium transition",
                      "focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50 focus-visible:outline-none",
                      collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-1.5",
                      active
                        ? "bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 font-semibold shadow-xs"
                        : item.subtle
                          ? "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                          : "text-sidebar-foreground/95 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      active && !collapsed && "border-l-2 border-blue-600",
                    )}
                  >
                    <item.icon
                      aria-hidden
                      className={cn(
                        "shrink-0",
                        collapsed ? "size-5" : "size-4",
                        active ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground",
                      )}
                    />
                    {collapsed ? (
                      badgeCount > 0 && (
                        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-blue-500" />
                      )
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        {badgeCount > 0 && (
                          <span className="ml-auto flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 font-mono text-[10px] font-bold tabular-nums text-white">
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
      <div className={cn("border-t border-sidebar-border bg-card/40", collapsed ? "p-2" : "p-3.5")}>
        {(() => {
          const presentation = platformState ? STATUS_PRESENTATION[platformState] : null;
          const dot = (
            <span
              aria-hidden
              className={cn(
                "size-2 rounded-full",
                presentation ? presentation.dot : "bg-muted-foreground/40",
                platformState === "operational" && "animate-pulse",
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
            <div className="flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-1.5">
                {dot}
                <span className="font-bold tracking-tight text-foreground">{COMPANY.name}</span>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                {presentation?.label ?? "Checking"}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
