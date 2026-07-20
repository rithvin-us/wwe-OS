"use client";

import { PanelLeft, Search } from "@bop/icons";
import { Button } from "@bop/ui/components/button";

import { NotificationCenter } from "@/components/notification-center";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The one header. Fixed height from the design system; hosts search,
 * notifications, and the theme switch. No account chrome — the platform
 * presents as one piece of company software.
 */
export function AppHeader({
  onOpenPalette,
  onOpenMobileNav,
}: {
  onOpenPalette: () => void;
  onOpenMobileNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-(--layout-header-height) shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <PanelLeft aria-hidden className="size-4" />
      </Button>

      <button
        type="button"
        onClick={onOpenPalette}
        className="flex h-8 w-full max-w-sm items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Search aria-hidden className="size-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="pointer-events-none hidden rounded-sm border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <NotificationCenter />
        <ThemeToggle />
      </div>
    </header>
  );
}
