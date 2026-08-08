"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // well inside the 15-minute access token lifetime

/**
 * Keeps a session alive silently in the background so a 15-minute access
 * token doesn't interrupt someone mid-task. Only forces a sign-out when the
 * refresh token itself has expired (7–30 days of real inactivity) — this is
 * the one path where that's actually the right thing to happen.
 */
export function SessionRefresh() {
  const router = useRouter();

  useEffect(() => {
    // 1. Keep session token alive silently
    const id = setInterval(async () => {
      const response = await fetch("/api/auth/refresh", { method: "POST" });
      if (!response.ok) {
        router.push("/login");
      }
    }, REFRESH_INTERVAL_MS);

    // 2. Auto-refresh live data when mobile app resumes or regains window focus
    function onFocusOrResume() {
      router.refresh();
    }

    window.addEventListener("focus", onFocusOrResume);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        onFocusOrResume();
      }
    });

    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocusOrResume);
    };
  }, [router]);

  return null;
}
