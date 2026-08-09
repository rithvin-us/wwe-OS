"use client";

import { UploadCloud } from "@bop/icons";
import { useTheme } from "@bop/theme";
import { Sheet, SheetContent, SheetTitle } from "@bop/ui/components/sheet";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { SplashScreen } from "@capacitor/splash-screen";
import { Style, StatusBar } from "@capacitor/status-bar";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { RithuChatWidget } from "@/components/chatbot/rithu-chat-widget";
import { CommandPalette } from "@/components/command-palette";
import { MobileFabDock } from "@/components/mobile-fab-dock";
import { SessionRefresh } from "@/components/session-refresh";

const SIDEBAR_HINT_SEEN_KEY = "wwe-os-sidebar-collapse-hint-seen";

/**
 * The platform shell: one sidebar, one header, one command palette.
 * Every routed page renders inside this frame — modules never build their own.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  // First time the rail collapses to icon-only, explain what happened and
  // how to undo it — after that the user already knows, never show again.
  useEffect(() => {
    if (!sidebarCollapsed) return;
    if (window.localStorage.getItem(SIDEBAR_HINT_SEEN_KEY)) return;
    window.localStorage.setItem(SIDEBAR_HINT_SEEN_KEY, "1");
    toast.info("Sidebar collapsed to icons only", {
      description: "Press Ctrl/Cmd+B anytime to switch it back.",
    });
  }, [sidebarCollapsed]);

  // Match the Android status bar to the app's theme — no-ops in the browser.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setOverlaysWebView({ overlay: true });
    void StatusBar.setStyle({ style: resolvedTheme === "dark" ? Style.Dark : Style.Light });
  }, [resolvedTheme]);

  // Hide the splash only once the shell itself has painted, not on first
  // script execution — launchAutoHide is off in capacitor.config.ts so this
  // is the one place that decides the app is actually ready to show.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void SplashScreen.hide();
  }, []);

  // Light tap feedback on every button — @bop/ui's Button always sets
  // data-slot="button", so this covers every button app-wide (submit,
  // check-in, approvals) without touching the shared component, which
  // other non-Capacitor apps in the monorepo also render.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-slot="button"]')) {
        void Haptics.impact({ style: ImpactStyle.Light });
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

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

    let dragCounter = 0;

    function onDragEnter(e: DragEvent) {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        dragCounter++;
        setIsDraggingOver(true);
      }
    }

    function onDragOver(e: DragEvent) {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    }

    function onDragLeave(e: DragEvent) {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          setIsDraggingOver(false);
        }
      }
    }

    function onDrop(e: DragEvent) {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        dragCounter = 0;
        setIsDraggingOver(false);

        const file = e.dataTransfer.files[0];
        const reader = new FileReader();

        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          window.dispatchEvent(
            new CustomEvent("rithu:attach-file", {
              detail: {
                name: file.name,
                type: file.type || "application/octet-stream",
                size: file.size,
                dataUrl,
                autoSubmit: true,
              },
            }),
          );
        };
        reader.readAsDataURL(file);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const sidebarWidth = sidebarCollapsed ? "4rem" : "var(--layout-sidebar-width)";

  return (
    <div className="relative min-h-svh">
      {/* Global Drag & Drop Overlay Zone */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center border-4 border-dashed border-emerald-500 bg-background/90 backdrop-blur-xl animate-in fade-in duration-150">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-emerald-500/40 bg-card p-10 shadow-2xl text-center max-w-md mx-4">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg animate-bounce">
              <UploadCloud className="size-8" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Drop File Anywhere</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Rithu AI will immediately inspect, analyze, and explain this document for you.
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/30">
              Agent Ready
            </span>
          </div>
        </div>
      )}

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
      <MobileFabDock />
      <SessionRefresh />
    </div>
  );
}
