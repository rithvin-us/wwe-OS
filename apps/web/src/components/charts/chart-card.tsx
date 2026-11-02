"use client";

import React from "react";
import {
  AlertCircle,
  BarChart3,
  Clock,
  FileBarChart2,
  FileText,
  History,
  IndianRupee,
  LineChart,
  PieChart,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
  Zap,
} from "@bop/icons";
import { Skeleton } from "@bop/ui/components/skeleton";
import { cn } from "@bop/ui/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "trending-up": TrendingUp,
  "bar-chart": BarChart3,
  "line-chart": LineChart,
  "pie-chart": PieChart,
  workflow: Workflow,
  users: Users,
  clock: Clock,
  rupee: IndianRupee,
  wallet: Wallet,
  history: History,
  zap: Zap,
  "file-text": FileText,
};

export interface ChartCardProps {
  title: string;
  description?: string;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  iconName?: keyof typeof ICON_MAP | string;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

/**
 * One card shape for every chart in the platform: title, optional one-line
 * description, and a content area that handles loading, failure and emptiness
 * in the card's own shape so nothing shifts when data arrives. The chrome is
 * deliberately quiet — the chart inside carries the colour.
 */
export function ChartCard({
  title,
  description,
  badge,
  icon: Icon,
  iconName,
  loading = false,
  error = null,
  empty = false,
  emptyMessage = "No data recorded for this period yet.",
  action,
  children,
  className,
  headerClassName,
}: ChartCardProps) {
  const MappedIcon = iconName ? ICON_MAP[iconName] : null;
  const IconComp = typeof Icon === "function" ? Icon : null;

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-lg border border-border bg-card p-5",
        className,
      )}
    >
      {/* Header */}
      <div className={cn("flex items-start justify-between gap-4 pb-4", headerClassName)}>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            {MappedIcon ? (
              <MappedIcon className="size-4 shrink-0 text-muted-foreground" />
            ) : React.isValidElement(Icon) ? (
              Icon
            ) : IconComp ? (
              <IconComp className="size-4 shrink-0 text-muted-foreground" />
            ) : null}
            <h3 className="text-sm font-medium text-card-foreground">{title}</h3>
          </div>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {badge && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{badge}</span>
          )}
          {action}
        </div>
      </div>

      {/* Content area: loading, failure, emptiness, or the chart itself */}
      <div className="relative min-h-40 w-full flex-1">
        {loading ? (
          <div className="flex h-full w-full flex-col justify-end gap-3 py-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ) : error ? (
          <div className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-md border border-destructive/30 p-5 text-center">
            <AlertCircle aria-hidden className="size-5 text-destructive" />
            <p className="text-sm font-medium text-destructive">Couldn&rsquo;t load this chart</p>
            <p className="max-w-xs text-xs text-muted-foreground">{error}</p>
          </div>
        ) : empty ? (
          <div className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-5 text-center">
            <FileBarChart2 aria-hidden className="size-5 text-muted-foreground-subtle" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
