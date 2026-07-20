import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";

import { AVAILABILITY_LABEL, type PlatformApp } from "@/config/modules";

/**
 * One launcher tile per app. The whole tile is the link — open the app,
 * nothing to manage. Apps that aren't ready say so in plain words.
 */
export function AppTile({ app }: { app: PlatformApp }) {
  const label = AVAILABILITY_LABEL[app.availability];

  return (
    <Link
      href={`/${app.slug}`}
      className={cn(
        "group flex items-start gap-3.5 rounded-lg border border-border bg-card p-4 transition-colors",
        "hover:border-ring/40 hover:bg-accent/40",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary transition-colors group-hover:bg-background">
        <app.icon aria-hidden className="size-5 text-secondary-foreground/80" />
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-card-foreground">{app.name}</span>
          {label ? (
            <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {label}
            </span>
          ) : null}
        </span>
        <span className="block text-[13px] leading-snug text-muted-foreground">{app.tagline}</span>
      </span>
    </Link>
  );
}
