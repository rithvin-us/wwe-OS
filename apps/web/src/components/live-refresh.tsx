"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const LIVE_REFRESH_INTERVAL_MS = 5000; // 5 seconds live data polling

/**
 * Live 5-second auto-refresh component.
 * Automatically refreshes Next.js Server Components data every 5 seconds so
 * background uploads, OCR extractions, and status updates appear live.
 *
 * Includes smart safeguards:
 * - Pauses when the tab/window is hidden.
 * - Pauses when the user is actively typing in an input, textarea, or select field.
 * - Pauses while a modal dialog or popup form is open.
 */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    function isInputActive(): boolean {
      const active = document.activeElement;
      if (!active) return false;
      const tag = active.tagName.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if ("isContentEditable" in active && (active as HTMLElement).isContentEditable) return true;
      return false;
    }

    function isDialogOpen(): boolean {
      return (
        document.querySelector('[role="dialog"]') !== null ||
        document.querySelector('[role="alertdialog"]') !== null
      );
    }

    const interval = setInterval(() => {
      // 1. Check tab visibility
      if (document.hidden || document.visibilityState !== "visible") return;

      // 2. Pause if user is typing or interacting with an input
      if (isInputActive()) return;

      // 3. Pause if a modal dialog is open
      if (isDialogOpen()) return;

      // Execute silent server component data refresh
      router.refresh();
    }, LIVE_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
