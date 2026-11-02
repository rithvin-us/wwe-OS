import { Activity, CircleDollarSign, ShoppingCart, TriangleAlert } from "@bop/icons";
import { Skeleton } from "@bop/ui/components/skeleton";

import { SectionCardSkeleton } from "@/components/dashboard/section-card";

/**
 * Full-page fallback for the Executive Dashboard. Mirrors the real layout's
 * dimensions exactly (same grid, same card heights) so streamed-in content
 * never shifts — this is what a fresh navigation shows instantly, before any
 * data has resolved.
 */
function ChartCardSkeleton({ height, className }: { height: string; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-5 ${className ?? ""}`}>
      <div className="space-y-1 pb-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className={height} />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-md" />
          ))}
        </div>
      </header>

      <section aria-label="Key figures">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-4">
        <ChartCardSkeleton height="h-[300px]" />
        <div className="grid gap-4 lg:grid-cols-12">
          <ChartCardSkeleton height="h-[180px]" className="lg:col-span-5" />
          <ChartCardSkeleton height="h-[180px]" className="lg:col-span-4" />
          <ChartCardSkeleton height="h-[180px]" className="lg:col-span-3" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCardSkeleton title="Financial summary" icon={CircleDollarSign} rows={4} />
            <SectionCardSkeleton title="Procurement & bills" icon={ShoppingCart} rows={4} />
          </div>
          <SectionCardSkeleton title="Recent activity" icon={Activity} rows={5} />
        </div>

        <div className="lg:col-span-4">
          <SectionCardSkeleton title="Operational alerts" icon={TriangleAlert} rows={3} />
        </div>
      </div>
    </div>
  );
}
