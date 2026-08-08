"use client";

import { useEffect, useState } from "react";
import { Clock, PanelLeft, PanelLeftClose, Search, User } from "@bop/icons";
import { Button } from "@bop/ui/components/button";

import { ActivityTicker } from "@/components/activity-ticker";
import { NotificationCenter } from "@/components/notification-center";
import { QuickActionsMenu } from "@/components/quick-actions-menu";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The one header. Fixed height from the design system; hosts search,
 * notifications, live time, user status, and the theme switch.
 */
export function AppHeader({
  onOpenPalette,
  onOpenMobileNav,
  onToggleSidebar,
  sidebarCollapsed,
}: {
  onOpenPalette: () => void;
  onOpenMobileNav: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}) {
  const [timeString, setTimeString] = useState<string>("");

  useEffect(() => {
    function updateClock() {
      const d = new Date();
      const datePart = d.toLocaleDateString("en-US", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const timePart = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setTimeString(`${datePart}  ${timePart}`);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="sticky top-0 z-20 flex h-(--layout-header-height) shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6"
      style={{
        height: "calc(var(--layout-header-height) + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Mobile nav toggle */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <PanelLeft aria-hidden className="size-4" />
      </Button>

      {/* Desktop sidebar toggle */}
      {onToggleSidebar && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden lg:inline-flex"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleSidebar}
        >
          {sidebarCollapsed ? (
            <PanelLeft aria-hidden className="size-4" />
          ) : (
            <PanelLeftClose aria-hidden className="size-4" />
          )}
        </Button>
      )}

      <button
        type="button"
        onClick={onOpenPalette}
        className="flex h-8 w-full max-w-xs items-center gap-2 rounded-md border border-input bg-card px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Search aria-hidden className="size-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="pointer-events-none hidden rounded-sm border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold text-foreground/80 sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <ActivityTicker />

        {/* Live Date / Time Clock Pill */}
        {timeString && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-md border border-border bg-card text-xs font-mono tabular-nums text-foreground">
            <Clock className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{timeString}</span>
          </div>
        )}

        {/* Signed in user badge */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-card text-xs">
          <User className="size-3.5 text-muted-foreground" />
          <div className="flex flex-col text-[11px] leading-tight">
            <span className="font-semibold text-foreground">LAKSHMANAN</span>
            <span className="text-[9px] text-muted-foreground font-mono">Signed in</span>
          </div>
        </div>

        <QuickActionsMenu />
        <NotificationCenter />
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
