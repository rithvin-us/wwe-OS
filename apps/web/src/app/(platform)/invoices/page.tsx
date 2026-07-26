"use client";

import { useState } from "react";
import { PageHeader } from "@bop/ui/components/page-header";
import { FileText, Plus, Download, Printer, Trash2, FileBarChart2, CheckCircle2 } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bop/ui/components/dialog";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { toast } from "sonner";

export interface InvoiceItem {
  id: string;
  number: string;
  customer: string;
  date: string;
  amount: number;
  status: "paid" | "pending";
  receivedDate?: string;
  receivedAmount?: number;
  paymentRef?: string;
}

const INITIAL_INVOICES: InvoiceItem[] = [
  {
    id: "inv-1",
    number: "INV-2026-089",
    customer: "Waterworks Engineering Pvt Ltd",
    date: "Jul 24, 2026",
    amount: 245000,
    status: "paid",
    receivedDate: "Jul 25, 2026",
    receivedAmount: 245000,
    paymentRef: "UTR-8912049",
  },
  {
    id: "inv-2",
    number: "INV-2026-090",
    customer: "Apex Industrial Machinery",
    date: "Jul 26, 2026",
    amount: 135000,
    status: "pending",
  },
];

function formatINR(val: number): string {
  return `₹${val.toLocaleString("en-IN")}`;
}

function formatLakhs(val: number): string {
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)}L`;
  }
  return formatINR(val);
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>(INITIAL_INVOICES);
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);

  // New Invoice Form state
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");

  // Mark as Paid Dialog state
  const [recvDate, setRecvDate] = useState("");
  const [recvAmount, setRecvAmount] = useState("");
  const [payRef, setPayRef] = useState("");

  function handleDelete(id: string, number: string) {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    toast.success(`Invoice ${number} deleted successfully`);
  }

  function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!customer.trim() || !amount) {
      toast.error("Please fill in customer name and amount.");
      return;
    }

    const numAmount = parseFloat(amount) || 0;
    const newNumber = `INV-2026-0${91 + invoices.length}`;
    const newDoc: InvoiceItem = {
      id: `inv-${Date.now()}`,
      number: newNumber,
      customer: customer.trim(),
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
      amount: numAmount,
      status: "pending",
    };

    setInvoices((prev) => [newDoc, ...prev]);
    setCustomer("");
    setAmount("");
    setOpenNewDialog(false);
    toast.success(`Invoice ${newNumber} generated (Pending payment).`);
  }

  function openMarkPaid(inv: InvoiceItem) {
    setSelectedInvoice(inv);
    setRecvDate(new Date().toISOString().split("T")[0]);
    setRecvAmount(inv.amount.toString());
    setPayRef("");
  }

  function handleConfirmMarkPaid(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (!recvDate || !recvAmount) {
      toast.error("Please enter the receiving date and received amount.");
      return;
    }

    const numRecv = parseFloat(recvAmount) || 0;
    const formattedDate = new Date(recvDate).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === selectedInvoice.id
          ? {
              ...inv,
              status: "paid",
              receivedDate: formattedDate,
              receivedAmount: numRecv,
              paymentRef: payRef.trim(),
            }
          : inv,
      ),
    );

    toast.success(
      `Invoice ${selectedInvoice.number} converted to PAID! Received ${formatINR(numRecv)} on ${formattedDate}.`,
    );
    setSelectedInvoice(null);
  }

  // Calculate totals
  const totalAmount = invoices.reduce((acc, inv) => acc + inv.amount, 0);
  const pendingAmount = invoices
    .filter((inv) => inv.status === "pending")
    .reduce((acc, inv) => acc + inv.amount, 0);
  const pendingCount = invoices.filter((inv) => inv.status === "pending").length;
  const paidAmount = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((acc, inv) => acc + (inv.receivedAmount || inv.amount), 0);
  const paidCount = invoices.filter((inv) => inv.status === "paid").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="In-house invoice generation, customer billing, and sales records."
        actions={
          <Dialog open={openNewDialog} onOpenChange={setOpenNewDialog}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
              >
                <Plus className="size-4" /> Generate New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleCreateInvoice}>
                <DialogHeader>
                  <DialogTitle>Generate New Invoice</DialogTitle>
                  <DialogDescription>
                    Create an in-house sales invoice for customer billing.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 text-xs">
                  <div className="grid gap-1.5">
                    <Label htmlFor="customer">Customer / Client Name</Label>
                    <Input
                      id="customer"
                      placeholder="e.g. Acme Corporation"
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="amount">Invoice Amount (INR)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="e.g. 150000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpenNewDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Create Invoice
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Total Generated Invoices</p>
          <h3 className="text-2xl font-bold font-mono tracking-tight text-foreground mt-1">
            {formatLakhs(totalAmount)}
          </h3>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {invoices.length} Invoices generated this month
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Pending Payments</p>
          <h3 className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 mt-1">
            {formatLakhs(pendingAmount)}
          </h3>
          <p className="text-[11px] text-muted-foreground font-mono mt-1">
            {pendingCount} Invoices pending customer clearance
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Paid & Settled</p>
          <h3 className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
            {formatLakhs(paidAmount)}
          </h3>
          <p className="text-[11px] text-muted-foreground font-mono mt-1">
            {paidCount} Invoices settled in full
          </p>
        </div>
      </div>

      {/* Mark as Paid Dialog Modal */}
      <Dialog open={!!selectedInvoice} onOpenChange={(o) => !o && setSelectedInvoice(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleConfirmMarkPaid}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" /> Record Payment & Mark Paid
              </DialogTitle>
              <DialogDescription>
                Convert status for{" "}
                <strong className="text-foreground">{selectedInvoice?.number}</strong> (
                {selectedInvoice?.customer}) to PAID.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 text-xs">
              <div className="grid gap-1.5">
                <Label htmlFor="recvDate">Receiving Date</Label>
                <Input
                  id="recvDate"
                  type="date"
                  value={recvDate}
                  onChange={(e) => setRecvDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="recvAmount">Received Amount (INR)</Label>
                <Input
                  id="recvAmount"
                  type="number"
                  placeholder="e.g. 135000"
                  value={recvAmount}
                  onChange={(e) => setRecvAmount(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="payRef">Payment Reference / UTR / Cheque (Optional)</Label>
                <Input
                  id="payRef"
                  placeholder="e.g. UTR-9823019 or HDFC Cheque #1029"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedInvoice(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Confirm & Mark Paid
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generated Invoices Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">In-house Invoices Log</h4>
            <p className="text-xs text-muted-foreground">Generated invoices for client billing</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => toast.info("Exporting invoice log...")}
            >
              <Download className="size-3.5" /> Export Summary
            </Button>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-2">
            <FileBarChart2 className="size-8 text-muted-foreground/50" />
            <h4 className="text-sm font-medium text-foreground">No invoices generated yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Click &quot;Generate New Invoice&quot; above to create your first in-house sales
              invoice.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left font-mono uppercase text-[10px] text-muted-foreground">
                  <th className="p-3 font-semibold">Invoice #</th>
                  <th className="p-3 font-semibold">Customer / Client</th>
                  <th className="p-3 font-semibold">Invoice Date</th>
                  <th className="p-3 font-semibold text-right">Amount</th>
                  <th className="p-3 font-semibold">Status & Payment Info</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono font-semibold text-foreground flex items-center gap-2">
                      <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                      {inv.number}
                    </td>
                    <td className="p-3 font-medium text-foreground">{inv.customer}</td>
                    <td className="p-3 text-muted-foreground font-mono">{inv.date}</td>
                    <td className="p-3 text-right font-mono font-semibold text-foreground">
                      {formatINR(inv.amount)}
                    </td>
                    <td className="p-3">
                      {inv.status === "paid" ? (
                        <div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                            Paid
                          </span>
                          {inv.receivedDate && (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Recd: {inv.receivedDate} (
                              {formatINR(inv.receivedAmount || inv.amount)})
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openMarkPaid(inv)}
                          title="Click to convert status to Paid (requires receiving date & amount)"
                          className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer flex items-center gap-1.5 group"
                        >
                          <span>Pending</span>
                          <span className="text-[9px] underline font-medium text-amber-800 dark:text-amber-300 group-hover:text-amber-900">
                            Record Payment
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {inv.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => openMarkPaid(inv)}
                        >
                          Mark Paid
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" title="Print Invoice">
                        <Printer className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Download PDF">
                        <Download className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete Invoice"
                        className="hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(inv.id, inv.number)}
                      >
                        <Trash2 className="size-3.5 text-destructive/80" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
