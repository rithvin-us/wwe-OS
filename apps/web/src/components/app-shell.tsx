"use client";

import { Sheet, SheetContent, SheetTitle } from "@bop/ui/components/sheet";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { SessionRefresh } from "@/components/session-refresh";

/**
 * The platform shell: one sidebar, one header, one command palette.
 * Every routed page renders inside this frame — modules never build their own.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-svh">
      <aside className="fixed inset-y-0 left-0 z-(--z-sticky) hidden w-(--layout-sidebar-width) border-r border-sidebar-border lg:block">
        <AppSidebar />
      </aside>

      <div className="flex min-h-svh flex-col lg:pl-(--layout-sidebar-width)">
        <AppHeader
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6 lg:px-8">
          {/* Restrained crossfade between routes — sidebar nav is lateral,
              not a drill-down, so a fade reads as "same place, new content"
              rather than implying a navigation direction that isn't there.
              Keyed remount + a mount-triggered animation, not the browser's
              View Transitions API — that needs a canary React build this
              app doesn't pin, so this is the reliable equivalent. */}
          <div
            key={pathname}
            className="animate-in fade-in duration-(--duration-base) ease-out-quart"
          >
            {children}
          </div>
        </main>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-(--layout-sidebar-width) p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <SessionRefresh />
    </div>
  );
}
