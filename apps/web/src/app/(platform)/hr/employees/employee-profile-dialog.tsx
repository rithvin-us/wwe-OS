"use client";

import { useState } from "react";
import { Eye, Briefcase, CreditCard, ScanFace, CheckCircle2 } from "@bop/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@bop/ui/components/avatar";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bop/ui/components/dialog";
import { SHIFT_NAMES, type Employee } from "@/lib/hr-constants";
import { EnrollFaceDialog } from "./[id]/enroll-face-dialog";

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function EmployeeProfileDialog({ employee }: { employee: Employee }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 cursor-pointer">
          <Eye className="size-3.5 text-muted-foreground" />
          View Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-6">
            <div className="flex items-center gap-3.5">
              {/* Photo Avatar */}
              <div className="relative group shrink-0">
                <Avatar className="size-14 border-2 border-border shadow-xs">
                  {employee.photo_url ? (
                    <AvatarImage
                      src={employee.photo_url}
                      alt={employee.employee_name}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-base font-bold font-mono">
                    {getInitials(employee.employee_name)}
                  </AvatarFallback>
                </Avatar>
                {employee.enrolled_at ? (
                  <div
                    className="absolute -bottom-1 -right-1 rounded-full bg-emerald-600 p-0.5 text-white shadow-xs ring-2 ring-background"
                    title="AI Face Biometrics Enrolled"
                  >
                    <CheckCircle2 className="size-3.5" />
                  </div>
                ) : null}
              </div>

              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  {employee.employee_name}
                </DialogTitle>
                <DialogDescription className="text-xs font-mono mt-0.5">
                  {employee.employee_code} · {employee.designation || "Operator"}
                </DialogDescription>
              </div>
            </div>

            {employee.is_active ? (
              <Badge variant="success">On the rolls</Badge>
            ) : (
              <Badge variant="outline">Left {employee.date_of_leaving}</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Employment Grid */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="size-4 text-emerald-500" /> Employment Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <DetailBox label="Department" value={employee.department || "Production"} />
              <DetailBox label="Shift" value={SHIFT_NAMES[employee.shift] ?? employee.shift} />
              <DetailBox label="Skill Category" value={employee.skill_category || "Skilled"} />
              <DetailBox label="Location" value={employee.location || "Factory"} />
              <DetailBox label="Date of Joining" value={employee.date_of_joining} />
              <DetailBox
                label="Monthly Salary"
                value={employee.salary > 0 ? `₹${employee.salary.toLocaleString("en-IN")}` : "—"}
              />
            </div>
          </div>

          {/* Statutory & Personal Grid */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="size-4 text-emerald-500" /> Statutory & Banking
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <DetailBox label="PF Number" value={employee.pf_number} />
              <DetailBox label="UAN" value={employee.uan} />
              <DetailBox label="ESIC Number" value={employee.esic_number} />
              <DetailBox label="Bank Account" value={employee.bank_account} />
              <DetailBox label="IFSC Code" value={employee.ifsc_code} />
              <DetailBox label="Phone" value={employee.phone} />
            </div>
          </div>

          {/* AI Face Recognition Section */}
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ScanFace className="size-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  AI Face Recognition Enrollment
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {employee.enrolled_at
                  ? `Enrolled on ${new Date(employee.enrolled_at).toLocaleDateString("en-IN")}. Biometric template active.`
                  : "Not enrolled. Upload reference photo for automated camera check-in."}
              </p>
            </div>

            <EnrollFaceDialog
              employeeId={employee.id}
              employeeName={employee.employee_name}
              isEnrolled={Boolean(employee.enrolled_at)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailBox({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5 p-2 rounded-lg bg-muted/30 border border-border/50">
      <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
      <div className="font-semibold text-foreground truncate">{value || "—"}</div>
    </div>
  );
}
