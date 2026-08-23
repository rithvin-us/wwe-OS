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

export function ChartCard({
  title,
  description,
  badge,
  icon: Icon,
  iconName,
  loading = false,
  error = null,
  empty = false,
  emptyMessage = "No data available for the selected period.",
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
        "flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm",
        className,
      )}
    >
      {/* Header */}
      <div className={cn("flex items-start justify-between gap-3 pb-3", headerClassName)}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {MappedIcon ? (
              <MappedIcon className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
            ) : React.isValidElement(Icon) ? (
              Icon
            ) : IconComp ? (
              <IconComp className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
            ) : null}
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          </div>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {badge && (
            <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase tracking-wider">
              {badge}
            </span>
          )}
          {action}
        </div>
      </div>

      {/* Content Area with Loading, Error, Empty, and Success states */}
      <div className="relative min-h-[180px] w-full flex-1 pt-1">
        {loading ? (
          <div className="flex h-full w-full flex-col justify-center gap-3 animate-pulse py-8">
            <div className="h-4 w-3/4 rounded bg-muted/60" />
            <div className="h-32 w-full rounded bg-muted/40" />
          </div>
        ) : error ? (
          <div className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
            <AlertCircle className="size-6 text-destructive" />
            <p className="text-xs font-semibold text-destructive">Failed to load chart</p>
            <p className="text-[11px] text-muted-foreground max-w-xs">{error}</p>
          </div>
        ) : empty ? (
          <div className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-center">
            <FileBarChart2 className="size-6 text-muted-foreground/60" />
            <p className="text-xs font-medium text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
