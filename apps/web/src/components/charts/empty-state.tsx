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
    <div className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
      <Icon aria-hidden className="size-5 text-muted-foreground-subtle" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
