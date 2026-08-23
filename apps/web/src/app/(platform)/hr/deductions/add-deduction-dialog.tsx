"use client";

import { useState } from "react";
import { PlusCircle } from "@bop/icons";
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

import { createDeduction } from "../actions";

interface AddDeductionDialogProps {
  employees: Array<{ id: string; employee_code: string; employee_name: string }>;
  year: number;
  month: number;
}

export function AddDeductionDialog({ employees, year, month }: AddDeductionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedEmp, setSelectedEmp] = useState(employees[0]?.id || "");
  const [type, setType] = useState("Advance");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmp || !amount || parseFloat(amount) <= 0) {
      setError("Please select an employee and enter a valid positive amount.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createDeduction({
      employee: selectedEmp,
      type,
      amount: parseFloat(amount),
      year,
      month,
      notes: notes.trim() || undefined,
    });

    setLoading(false);
    if (res.ok) {
      setOpen(false);
      setAmount("");
      setNotes("");
    } else {
      setError(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
          <PlusCircle className="size-3.5" />
          Record Deduction
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Salary Deduction</DialogTitle>
          <DialogDescription>
            Record salary advance, fine, damage loss, or loan repayment for Form B statutory
            records.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-2.5 text-xs rounded-md bg-destructive/10 text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="employee" className="text-xs">
              Employee *
            </Label>
            <select
              id="employee"
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={selectedEmp}
              onChange={(e) => setSelectedEmp(e.target.value)}
              required
            >
              {employees.length === 0 ? (
                <option value="">No employees available</option>
              ) : (
                employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employee_code} - {emp.employee_name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-xs">
                Deduction Category *
              </Label>
              <select
                id="type"
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="Advance">Salary Advance</option>
                <option value="Fine">Fine / Disciplinary</option>
                <option value="Damage">Damage / Loss</option>
                <option value="Loan">Loan Repayment</option>
                <option value="Other">Other Deduction</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs">
                Amount (₹) *
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">
              Reason / Notes
            </Label>
            <Input
              id="notes"
              placeholder="e.g. Festival advance repayment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || employees.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? "Saving..." : "Record Deduction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
