"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  FileSpreadsheet,
  IndianRupee,
  LayoutDashboard,
  MinusCircle,
  Receipt,
  Users,
} from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";

const HR_TABS = [
  { name: "Overview", href: "/hr", icon: LayoutDashboard },
  { name: "Employees", href: "/hr/employees", icon: Users },
  { name: "Attendance", href: "/hr/attendance", icon: CalendarCheck },
  { name: "Payroll", href: "/hr/payroll", icon: IndianRupee },
  { name: "Deductions", href: "/hr/deductions", icon: MinusCircle },
  { name: "Expenses", href: "/hr/expenses", icon: Receipt },
  { name: "Leave & Holidays", href: "/hr/leave", icon: CalendarDays },
  { name: "Statutory Registers", href: "/hr/registers", icon: FileSpreadsheet },
];

export function HrNav({ activeTab }: { activeTab?: string }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-border bg-card/50 px-1 -mx-4 md:-mx-6 lg:-mx-8 mb-6">
      <nav className="flex items-center gap-1 overflow-x-auto px-4 md:px-6 lg:px-8 no-scrollbar py-2">
        {HR_TABS.map((tab) => {
          const isActive =
            tab.href === "/hr"
              ? pathname === "/hr"
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0",
                isActive
                  ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 font-semibold border-b-2 border-emerald-600 shadow-xs"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <tab.icon
                className={cn(
                  "size-3.5 shrink-0",
                  isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                )}
              />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
