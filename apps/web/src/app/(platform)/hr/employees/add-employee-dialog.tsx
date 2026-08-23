"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UserPlus } from "@bop/icons";
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

import { createEmployee } from "../actions";

export function AddEmployeeDialog() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams?.get("action") === "new" || searchParams?.get("action") === "add") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- opens from the URL once, then the user owns the state; deriving it during render would make the dialog impossible to close
      setOpen(true);
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("Production");
  const [designation, setDesignation] = useState("Operator");
  const [category] = useState("Skilled");
  const [doj, setDoj] = useState(new Date().toISOString().slice(0, 10));
  const [basicRate, setBasicRate] = useState("15000");
  const [daRate] = useState("0");
  const [pfNumber, setPfNumber] = useState("");
  const [esicNumber, setEsicNumber] = useState("");
  const [uanNumber, setUanNumber] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError("Employee code and name are required.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createEmployee({
      employee_code: code.trim(),
      name: name.trim(),
      department: department.trim(),
      designation: designation.trim(),
      category,
      date_of_joining: doj,
      basic_rate: parseFloat(basicRate) || 0,
      da_rate: parseFloat(daRate) || 0,
      pf_number: pfNumber.trim() || undefined,
      esic_number: esicNumber.trim() || undefined,
      uan_number: uanNumber.trim() || undefined,
    });

    setLoading(false);
    if (res.ok) {
      setOpen(false);
      setCode("");
      setName("");
    } else {
      setError(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
          <UserPlus className="size-3.5" />
          Add Employee
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>
            Add an employee to the Employee Master. Attendance and payroll will build from this
            record.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-2.5 text-xs rounded-md bg-destructive/10 text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-xs">
                Employee Code *
              </Label>
              <Input
                id="code"
                placeholder="EMP001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">
                Full Name *
              </Label>
              <Input
                id="name"
                placeholder="RAJA K"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dept" className="text-xs">
                Department
              </Label>
              <Input id="dept" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desig" className="text-xs">
                Designation
              </Label>
              <Input
                id="desig"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="basic" className="text-xs">
                Basic Wage Rate (₹)
              </Label>
              <Input
                id="basic"
                type="number"
                value={basicRate}
                onChange={(e) => setBasicRate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doj" className="text-xs">
                Joining Date
              </Label>
              <Input id="doj" type="date" value={doj} onChange={(e) => setDoj(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="pf" className="text-[11px]">
                PF No.
              </Label>
              <Input
                id="pf"
                className="text-xs"
                placeholder="Optional"
                value={pfNumber}
                onChange={(e) => setPfNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="esic" className="text-[11px]">
                ESIC No.
              </Label>
              <Input
                id="esic"
                className="text-xs"
                placeholder="Optional"
                value={esicNumber}
                onChange={(e) => setEsicNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="uan" className="text-[11px]">
                UAN No.
              </Label>
              <Input
                id="uan"
                className="text-xs"
                placeholder="Optional"
                value={uanNumber}
                onChange={(e) => setUanNumber(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? "Saving..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
