import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";
import { FileText, Plus, Download, Printer } from "@bop/icons";
import { Button } from "@bop/ui/components/button";

export const metadata: Metadata = {
  title: "Invoices",
};

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="In-house invoice generation, customer billing, and sales records."
        actions={
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
          >
            <Plus className="size-4" /> Generate New Invoice
          </Button>
        }
      />

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Total Generated Invoices</p>
          <h3 className="text-2xl font-bold font-mono tracking-tight text-foreground mt-1">
            ₹14.25L
          </h3>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            24 Invoices generated this month
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Pending Payments</p>
          <h3 className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 mt-1">
            ₹3.80L
          </h3>
          <p className="text-[11px] text-muted-foreground font-mono mt-1">
            5 Invoices pending customer clearance
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Paid & Settled</p>
          <h3 className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
            ₹10.45L
          </h3>
          <p className="text-[11px] text-muted-foreground font-mono mt-1">
            19 Invoices settled in full
          </p>
        </div>
      </div>

      {/* Generated Invoices Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">In-house Invoices Log</h4>
            <p className="text-xs text-muted-foreground">Generated invoices for client billing</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
              <Download className="size-3.5" /> Export Summary
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left font-mono uppercase text-[10px] text-muted-foreground">
                <th className="p-3 font-semibold">Invoice #</th>
                <th className="p-3 font-semibold">Customer / Client</th>
                <th className="p-3 font-semibold">Date</th>
                <th className="p-3 font-semibold text-right">Amount</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-muted/30 transition-colors">
                <td className="p-3 font-mono font-semibold text-foreground flex items-center gap-2">
                  <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                  INV-2026-089
                </td>
                <td className="p-3 font-medium text-foreground">Waterworks Engineering Pvt Ltd</td>
                <td className="p-3 text-muted-foreground font-mono">Jul 24, 2026</td>
                <td className="p-3 text-right font-mono font-semibold text-foreground">
                  ₹2,45,000
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                    Paid
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <Button variant="ghost" size="icon-sm" title="Print Invoice">
                    <Printer className="size-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="Download PDF">
                    <Download className="size-3.5 text-muted-foreground" />
                  </Button>
                </td>
              </tr>

              <tr className="hover:bg-muted/30 transition-colors">
                <td className="p-3 font-mono font-semibold text-foreground flex items-center gap-2">
                  <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                  INV-2026-090
                </td>
                <td className="p-3 font-medium text-foreground">Apex Industrial Machinery</td>
                <td className="p-3 text-muted-foreground font-mono">Jul 26, 2026</td>
                <td className="p-3 text-right font-mono font-semibold text-foreground">
                  ₹1,35,000
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20">
                    Pending
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <Button variant="ghost" size="icon-sm" title="Print Invoice">
                    <Printer className="size-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="Download PDF">
                    <Download className="size-3.5 text-muted-foreground" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
