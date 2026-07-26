"use client";

import { TrendingUp } from "@bop/icons";

interface GstTaxBarProps {
  totalGst: number;
  cgst: number;
  sgst: number;
  igst: number;
  billsCount: number;
}

export function GstTaxBar({ totalGst, cgst, sgst, igst, billsCount }: GstTaxBarProps) {
  const total = cgst + sgst + igst || 1;
  const cgstPct = Math.round((cgst / total) * 100);
  const sgstPct = Math.round((sgst / total) * 100);
  const igstPct = Math.round((igst / total) * 100);

  function formatINR(val: number): string {
    return `₹${val.toLocaleString("en-IN")}`;
  }

  if (billsCount === 0 && totalGst === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 flex flex-col items-center justify-center text-center space-y-1.5 shadow-xs">
        <TrendingUp className="size-5 text-muted-foreground/60" />
        <h4 className="text-sm font-semibold tracking-tight text-foreground">
          GST Input Tax Credit (ITC) Breakdown
        </h4>
        <p className="text-xs text-muted-foreground">
          No digitized bills or GST claims recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            GST Input Tax Credit (ITC) Breakdown
          </h3>
        </div>
        <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
          {billsCount} Digitized Bills
        </span>
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Total Claimable ITC:</span>
          <span className="font-mono text-base font-bold text-foreground">
            {formatINR(totalGst)}
          </span>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted">
          <div
            title={`CGST: ${formatINR(cgst)} (${cgstPct}%)`}
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${cgstPct}%` }}
          />
          <div
            title={`SGST: ${formatINR(sgst)} (${sgstPct}%)`}
            className="h-full bg-teal-500 transition-all duration-500"
            style={{ width: `${sgstPct}%` }}
          />
          <div
            title={`IGST: ${formatINR(igst)} (${igstPct}%)`}
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${igstPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs font-mono pt-1 text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-600" />
            <span>CGST: {formatINR(cgst)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-teal-500" />
            <span>SGST: {formatINR(sgst)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-indigo-500" />
            <span>IGST: {formatINR(igst)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
