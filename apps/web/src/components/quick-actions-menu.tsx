"use client";

import Link from "next/link";
import { FileSpreadsheet, FileText, PlusCircle, Receipt, Truck, UserPlus, Zap } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bop/ui/components/dropdown-menu";

const QUICK_ACTIONS = [
  { name: "Upload Bill", href: "/purchase?action=upload", icon: Receipt, module: "Purchases" },
  { name: "Generate Invoice", href: "/invoices?action=new", icon: FileText, module: "Invoices" },
  { name: "Add Employee", href: "/hr/employees?action=new", icon: UserPlus, module: "HR" },
  {
    name: "Generate Report",
    href: "/reports?action=new",
    icon: FileSpreadsheet,
    module: "Reports",
  },
  { name: "Create Delivery Challan", href: "/assets?action=new", icon: Truck, module: "Logistics" },
  { name: "Run Automation", href: "/automation?action=new", icon: Zap, module: "Automation" },
];

export function QuickActionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
        >
          <PlusCircle className="size-3.5" />
          <span className="hidden sm:inline">Quick Action</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-mono uppercase text-muted-foreground">
          Platform Actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {QUICK_ACTIONS.map((action) => (
          <DropdownMenuItem key={action.name} asChild>
            <Link
              href={action.href}
              className="flex items-center justify-between cursor-pointer text-xs"
            >
              <div className="flex items-center gap-2">
                <action.icon className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{action.name}</span>
              </div>
              <span className="font-mono text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {action.module}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
