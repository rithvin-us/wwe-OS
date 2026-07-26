"use client";

import { ShieldCheck } from "@bop/icons";

interface ComplianceGaugeProps {
  label: string;
  percentage: number;
  color: string;
}

function GaugeRing({ label, percentage, color }: ComplianceGaugeProps) {
  const circumference = 2 * Math.PI * 24;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-border bg-card/50 text-center space-y-1.5">
      <div className="relative size-16 flex items-center justify-center">
        <svg className="size-full -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28"
            cy="28"
            r="24"
            className="stroke-muted"
            strokeWidth="4"
            fill="transparent"
          />
          <circle
            cx="28"
            cy="28"
            r="24"
            stroke={color}
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span className="absolute font-mono text-xs font-bold text-foreground">{percentage}%</span>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export function HrComplianceGauges() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Statutory Register Readiness
          </h3>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
          Form Compliance
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
        <GaugeRing label="PF Enrolled" percentage={94} color="var(--module-hr)" />
        <GaugeRing label="ESIC Active" percentage={88} color="var(--chart-2)" />
        <GaugeRing label="UAN Verified" percentage={92} color="var(--chart-1)" />
        <GaugeRing label="Photo Check-in" percentage={100} color="var(--chart-3)" />
      </div>
    </div>
  );
}
