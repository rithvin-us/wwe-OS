"use client";

import { RefreshCw } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode, type TouchEvent } from "react";

const TRIGGER_DISTANCE = 70;
const MAX_PULL = 110;

/**
 * Native-feel swipe-down-to-refresh for a server-rendered page. Wraps
 * children rather than replacing their markup — the wrapped content stays
 * server-rendered, this just adds a touch gesture around it and calls
 * router.refresh() to re-run the page's data fetching.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  function onTouchStart(event: TouchEvent) {
    if (window.scrollY > 0 || refreshing) return;
    startY.current = event.touches[0].clientY;
  }

  function onTouchMove(event: TouchEvent) {
    if (startY.current === null) return;
    const delta = event.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPull(0);
      return;
    }
    setPull(Math.min(delta * 0.5, MAX_PULL));
  }

  function onTouchEnd() {
    if (pull >= TRIGGER_DISTANCE) {
      setRefreshing(true);
      if (Capacitor.isNativePlatform()) {
        void Haptics.impact({ style: ImpactStyle.Medium });
      }
      router.refresh();
      // router.refresh() doesn't resolve when the new data has painted —
      // give it a moment to land, then drop the indicator either way.
      setTimeout(() => setRefreshing(false), 800);
    }
    setPull(0);
    startY.current = null;
  }

  const indicatorVisible = pull > 0 || refreshing;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden text-blue-600 transition-[height] duration-(--duration-fast) ease-out-quart dark:text-blue-400",
          !indicatorVisible && "duration-(--duration-base) ease-out-quart",
        )}
        style={{ height: refreshing ? 40 : pull }}
        aria-hidden={!indicatorVisible}
      >
        <RefreshCw
          className={cn("size-4", refreshing && "animate-spin")}
          style={
            !refreshing
              ? { transform: `rotate(${pull * 3}deg)`, opacity: pull / TRIGGER_DISTANCE }
              : undefined
          }
        />
      </div>
      {children}
    </div>
  );
}
