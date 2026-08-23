"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on every page load.
 *
 * Previously /sw.js was only registered from push-client.ts, at the moment a
 * user opted into notifications — so anyone who never enabled push had no
 * worker at all, and Chromium's install criteria (manifest + a worker with a
 * fetch handler) were never met. Registering the same URL twice is
 * idempotent, so the push flow keeps working unchanged.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration only costs offline support and installability;
        // it must never surface to a business user or block the page.
      });
    };
    // Wait for load so registration never competes with first paint.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
