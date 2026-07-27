"use client";

import { useMemo, useState } from "react";

import { Search } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Input } from "@bop/ui/components/input";

import { SHIFT_NAMES, type Employee } from "@/lib/hr-constants";
import { EnrollFaceDialog } from "./[id]/enroll-face-dialog";
import { EmployeeProfileDialog } from "./employee-profile-dialog";

/**
 * The employee master. Filtering is client-side on purpose: the whole list is
 * a few hundred rows at this company's scale, so a round trip per keystroke
 * would be slower and no more correct.
 */
export function EmployeeTable({ employees }: { employees: Employee[] }) {
  const [query, setQuery] = useState("");
  const [showLeft, setShowLeft] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter((employee) => {
      if (!showLeft && !employee.is_active) return false;
      if (!needle) return true;
      return (
        employee.employee_name.toLowerCase().includes(needle) ||
        employee.employee_code.toLowerCase().includes(needle) ||
        employee.department.toLowerCase().includes(needle)
      );
    });
  }, [employees, query, showLeft]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, code, or department"
            className="pl-9"
            aria-label="Search employees"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showLeft}
            onChange={(event) => setShowLeft(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Include people who have left
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Designation</th>
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Shift</th>
              <th className="px-3 py-2 text-right font-medium">Joined</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((employee) => (
              <tr
                key={employee.id}
                className="border-t border-border/60 transition-colors hover:bg-accent/50"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  <span className="font-semibold text-foreground font-mono">
                    {employee.employee_code}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">{employee.employee_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{employee.designation || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{employee.department || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {SHIFT_NAMES[employee.shift] ?? employee.shift}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {employee.date_of_joining}
                </td>
                <td className="px-3 py-2">
                  {employee.is_active ? (
                    <Badge variant="success">On the rolls</Badge>
                  ) : (
                    <Badge variant="outline">Left {employee.date_of_leaving}</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <EmployeeProfileDialog employee={employee} />
                    <EnrollFaceDialog
                      employeeId={employee.id}
                      employeeName={employee.employee_name}
                      isEnrolled={Boolean(employee.enrolled_at)}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No employees match that search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
