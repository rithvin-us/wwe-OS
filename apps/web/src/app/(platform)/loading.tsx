import { Activity, CircleDollarSign, ShoppingCart, Sparkles, TriangleAlert } from "@bop/icons";
import { Skeleton } from "@bop/ui/components/skeleton";

import { SectionCardSkeleton } from "@/components/dashboard/section-card";

/**
 * Full-page fallback for the Executive Dashboard. Mirrors the real layout's
 * dimensions exactly (same grid, same card heights) so streamed-in content
 * never shifts — this is what a fresh navigation shows instantly, before any
 * data has resolved.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-4 pb-6 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-md" />
          ))}
        </div>
      </div>

      <section aria-label="Key figures">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="size-4 rounded-full" />
              </div>
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <SectionCardSkeleton title="Financial summary" icon={CircleDollarSign} rows={4} />
          <SectionCardSkeleton title="Procurement & bills" icon={ShoppingCart} rows={4} />
          <SectionCardSkeleton title="Recent activity" icon={Activity} rows={5} />
        </div>

        <div className="space-y-4 lg:col-span-4">
          <SectionCardSkeleton title="Operational alerts" icon={TriangleAlert} rows={3} />
          <SectionCardSkeleton title="AI insights" icon={Sparkles} rows={2} />
        </div>
      </div>
    </div>
  );
}
