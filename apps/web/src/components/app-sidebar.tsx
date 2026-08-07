"use client";

import { ScrollArea } from "@bop/ui/components/scroll-area";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { COMPANY } from "@/config/company";
import { NAVIGATION } from "@/config/navigation";

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

  return (
    <div
      className="flex h-full flex-col bg-sidebar text-sidebar-foreground"
      style={{ minWidth: collapsed ? "4rem" : "var(--layout-sidebar-width)" }}
    >
      <Link
        href="/"
        onClick={onNavigate}
        className={cn(
          "flex h-(--layout-header-height) shrink-0 items-center gap-2.5 border-b border-sidebar-border focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50 focus-visible:outline-none",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 font-display text-[11px] font-bold text-white shadow-xs shrink-0">
          {COMPANY.mark}
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate font-display text-[13px] font-bold tracking-tight text-foreground">
              WWE OS
            </span>
            <span className="block font-mono text-[9px] tracking-[0.14em] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
              OPERATIONS_PLATFORM_V1
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
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.name : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-[13px] font-medium transition-all",
                      "focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50 focus-visible:outline-none",
                      collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-1.5",
                      active
                        ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 font-semibold shadow-xs"
                        : item.subtle
                          ? "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                          : "text-sidebar-foreground/95 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      active && !collapsed && "border-l-2 border-emerald-600",
                    )}
                  >
                    <item.icon
                      aria-hidden
                      className={cn(
                        "shrink-0",
                        collapsed ? "size-5" : "size-4",
                        active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                      )}
                    />
                    {!collapsed && item.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Industrial Corporate Status Footer */}
      <div className={cn("border-t border-sidebar-border bg-card/40", collapsed ? "p-2" : "p-3.5")}>
        {collapsed ? (
          <div className="flex justify-center">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold tracking-tight text-foreground">{COMPANY.name}</span>
            </div>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
              Connected
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
