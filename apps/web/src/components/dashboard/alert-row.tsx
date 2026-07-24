import { CircleAlert, Info, TriangleAlert } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";

import type { AlertItem } from "@/config/dashboard";

// Semantic vocabulary (business-data outcome), not the module-status
// palette — an operational alert is a different kind of "state" than a
// module being operational or needing attention (see design-bible.md's
// Reserved Vocabulary Rule).
const SEVERITY_ICON = {
  info: Info,
  warning: TriangleAlert,
  critical: CircleAlert,
} as const;

const SEVERITY_COLOR = {
  info: "text-muted-foreground",
  warning: "text-warning",
  critical: "text-destructive",
} as const;

/** One operational alert — deep-links to the area it's about, severity
 * carried by icon + color rather than discarded. */
export function AlertRow({ alert }: { alert: AlertItem }) {
  const Icon = SEVERITY_ICON[alert.severity];

  return (
    <li>
      <Link
        href={alert.href}
        className="-mx-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Icon
          aria-hidden
          className={cn("mt-0.5 size-3.5 shrink-0", SEVERITY_COLOR[alert.severity])}
        />
        <span className="min-w-0 flex-1">
          <span className="text-foreground">{alert.message}</span>
          <span className="ml-1 text-xs text-muted-foreground">— {alert.area}</span>
        </span>
      </Link>
    </li>
  );
}
