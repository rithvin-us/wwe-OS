import type { Metadata } from "next";
import { Users } from "@bop/icons";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";

import { getEmployees } from "@/lib/hr";
import { HrNav } from "../hr-nav";

import { AddEmployeeDialog } from "./add-employee-dialog";
import { EmployeeTable } from "./employee-table";

import { ShareCheckInLinkButton } from "../attendance/share-link-button";

export const metadata: Metadata = {
  title: "Employees",
};

export default async function EmployeesPage() {
  const employees = await getEmployees().catch(() => []);

  const onRolls = employees.filter((e) => e.is_active).length;
  const left = employees.length - onRolls;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="The master record every register, payslip and attendance sheet is built from."
        actions={
          <div className="flex items-center gap-2">
            <ShareCheckInLinkButton />
            <AddEmployeeDialog />
          </div>
        }
      />

      <HrNav activeTab="employees" />

      {employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="Once employees are on the rolls they appear here, and the attendance grid and payroll follow from this list."
          action={<AddEmployeeDialog />}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {onRolls} on the rolls
            {left > 0 ? ` · ${left} left` : ""}
          </p>
          <EmployeeTable employees={employees} />
        </>
      )}
    </div>
  );
}
