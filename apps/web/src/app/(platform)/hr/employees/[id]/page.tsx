import Link from "next/link";

import { ArrowLeft, CheckCircle2, ScanFace } from "@bop/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@bop/ui/components/avatar";
import { Badge } from "@bop/ui/components/badge";

import { getEmployee, getEmployeeTasks, SHIFT_NAMES } from "@/lib/hr";

import { ChecklistPanel } from "./checklist-panel";
import { EnrollFaceDialog } from "./enroll-face-dialog";

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

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

      {/* Employee Profile Hero Card with Photo Avatar */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-muted/20 p-6 shadow-xs">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            {/* Photo Avatar */}
            <div className="relative group shrink-0">
              <Avatar className="size-20 border-2 border-border shadow-md ring-4 ring-background">
                {employee.photo_url ? (
                  <AvatarImage
                    src={employee.photo_url}
                    alt={employee.employee_name}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold font-mono">
                  {getInitials(employee.employee_name)}
                </AvatarFallback>
              </Avatar>
              {employee.enrolled_at ? (
                <div
                  className="absolute -bottom-1 -right-1 rounded-full bg-emerald-600 p-1 text-white shadow-md ring-2 ring-background"
                  title="AI Face Biometrics Enrolled"
                >
                  <CheckCircle2 className="size-4" />
                </div>
              ) : null}
            </div>

            {/* Employee Meta Info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {employee.employee_name}
                </h1>
                <Badge variant="outline" className="font-mono text-xs font-semibold">
                  {employee.employee_code}
                </Badge>
                {employee.is_active ? (
                  <Badge variant="success">On the rolls</Badge>
                ) : (
                  <Badge variant="outline">Left {employee.date_of_leaving}</Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">
                  {employee.designation || "Operator"}
                </span>
                <span>·</span>
                <span>{employee.department || "General"}</span>
                <span>·</span>
                <span>{employee.location}</span>
              </p>

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-foreground font-mono font-medium">
                  Shift: {SHIFT_NAMES[employee.shift] ?? employee.shift}
                </span>
                <span>·</span>
                <span>Joined {employee.date_of_joining}</span>
              </div>
            </div>
          </div>

          {/* Face Enrolment Button */}
          <div className="shrink-0 self-start sm:self-center">
            <EnrollFaceDialog
              employeeId={employee.id}
              employeeName={employee.employee_name}
              isEnrolled={Boolean(employee.enrolled_at)}
            />
          </div>
        </div>
      </div>

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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ScanFace className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold">AI Face Recognition & Photo Check-in</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {employee.enrolled_at
                ? `Enrolled on ${new Date(employee.enrolled_at).toLocaleDateString("en-IN")}. Reference biometric embedding is active.`
                : "Not enrolled. Upload a photo below so InsightFace AI can extract their biometric template for self-service attendance."}
            </p>
          </div>
          <EnrollFaceDialog
            employeeId={employee.id}
            employeeName={employee.employee_name}
            isEnrolled={Boolean(employee.enrolled_at)}
          />
        </div>
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
