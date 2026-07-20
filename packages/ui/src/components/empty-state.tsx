import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@bop/ui/lib/utils";

/**
 * One empty state for the whole platform. An empty screen is an invitation
 * to act: say what is empty, why, and what to do next.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden className="mb-1 size-5 text-muted-foreground" /> : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
