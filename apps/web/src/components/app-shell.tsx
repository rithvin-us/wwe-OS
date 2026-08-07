"use client";

import { Sheet, SheetContent, SheetTitle } from "@bop/ui/components/sheet";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { RithuChatWidget } from "@/components/chatbot/rithu-chat-widget";
import { CommandPalette } from "@/components/command-palette";
import { SessionRefresh } from "@/components/session-refresh";

/**
 * The platform shell: one sidebar, one header, one command palette.
 * Every routed page renders inside this frame — modules never build their own.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Toggle search palette with Alt+Space or Ctrl/Cmd+K
      const isCmdK = (event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey);
      const isAltSpace =
        event.altKey && (event.code === "Space" || event.key === " " || event.key === "Spacebar");

      if (isCmdK || isAltSpace) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      // Toggle sidebar with Ctrl+B
      if (event.key === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSidebarCollapsed((c) => !c);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const sidebarWidth = sidebarCollapsed ? "4rem" : "var(--layout-sidebar-width)";

  return (
    <div className="min-h-svh">
      <aside
        className="fixed inset-y-0 left-0 z-(--z-sticky) hidden border-r border-sidebar-border lg:block overflow-hidden transition-[width] duration-200 ease-out"
        style={{ width: sidebarWidth }}
      >
        <AppSidebar collapsed={sidebarCollapsed} />
      </aside>

      <div
        className="flex min-h-svh flex-col transition-[padding-left] duration-200 ease-out"
        style={{ paddingLeft: undefined }}
      >
        {/* On lg screens, apply dynamic padding; below lg, no sidebar padding */}
        <style>{`
          @media (min-width: 1024px) {
            .shell-main-area { padding-left: ${sidebarWidth}; }
          }
        `}</style>
        <div className="shell-main-area flex min-h-svh flex-col">
          <AppHeader
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
            sidebarCollapsed={sidebarCollapsed}
          />
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6 lg:px-8">
            <div
              key={pathname}
              className="animate-in fade-in duration-(--duration-base) ease-out-quart"
            >
              {children}
            </div>
          </main>
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-(--layout-sidebar-width) p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <RithuChatWidget />
      <SessionRefresh />
    </div>
  );
}
