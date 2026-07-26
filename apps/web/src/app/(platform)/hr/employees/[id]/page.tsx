import Link from "next/link";

import { ArrowLeft, ScanFace } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { PageHeader } from "@bop/ui/components/page-header";

import { getEmployee, getEmployeeTasks, SHIFT_NAMES } from "@/lib/hr";

import { ChecklistPanel } from "./checklist-panel";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [employee, tasks] = await Promise.all([
    getEmployee(id),
    getEmployeeTasks({ employee: id }),
  ]);

  const onboarding = tasks.filter((task) => task.workflow === "onboarding");
  const offboarding = tasks.filter((task) => task.workflow === "offboarding");

  return (
    <div className="space-y-6">
      <Link
        href="/hr/employees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All employees
      </Link>

      <PageHeader
        title={employee.employee_name}
        description={`${employee.employee_code} · ${employee.designation || "No designation"}`}
        actions={
          employee.is_active ? (
            <Badge variant="success">On the rolls</Badge>
          ) : (
            <Badge variant="outline">Left {employee.date_of_leaving}</Badge>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <h2 className="mb-3 text-sm font-semibold">Employment</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Department" value={employee.department} />
            <Row label="Shift" value={SHIFT_NAMES[employee.shift] ?? employee.shift} />
            <Row label="Skill category" value={employee.skill_category} />
            <Row label="Location" value={employee.location} />
            <Row label="Date of joining" value={employee.date_of_joining} />
            {employee.date_of_leaving ? (
              <Row label="Date of leaving" value={employee.date_of_leaving} />
            ) : null}
            <Row
              label="Monthly salary"
              value={employee.salary > 0 ? `₹${employee.salary.toLocaleString("en-IN")}` : "—"}
            />
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <h2 className="mb-3 text-sm font-semibold">Statutory & personal</h2>
          <dl className="space-y-2 text-sm">
            <Row label="PF number" value={employee.pf_number} />
            <Row label="UAN" value={employee.uan} />
            <Row label="ESIC number" value={employee.esic_number} />
            <Row label="Age / gender" value={employee.age_gender_display} />
            <Row label="Father / husband" value={employee.father_husband_name} />
            <Row label="Phone" value={employee.phone} />
            <Row label="Bank account" value={employee.bank_account} />
            <Row label="IFSC" value={employee.ifsc_code} />
          </dl>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <ScanFace className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Photo check-in</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {employee.enrolled_at
            ? `Enrolled on ${new Date(employee.enrolled_at).toLocaleDateString("en-IN")}. They can check in from the shared check-in link.`
            : "Not enrolled. Until a reference photo is captured, this employee cannot use self-service check-in."}
        </p>
      </section>

      {onboarding.length > 0 ? (
        <ChecklistPanel title="Onboarding checklist" tasks={onboarding} />
      ) : null}
      {offboarding.length > 0 ? (
        <ChecklistPanel title="Offboarding checklist" tasks={offboarding} />
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}
