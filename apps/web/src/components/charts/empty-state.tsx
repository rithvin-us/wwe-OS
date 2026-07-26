"use client";

import React from "react";
import { FileBarChart2 } from "@bop/icons";

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyStateComponent({
  icon: Icon = FileBarChart2,
  title = "No data available",
  description = "No entries recorded for the selected range.",
  action,
}: EmptyStateProps) {
  return (
    <div className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center bg-card/40">
      <Icon className="size-8 text-muted-foreground/60" />
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground max-w-xs">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
