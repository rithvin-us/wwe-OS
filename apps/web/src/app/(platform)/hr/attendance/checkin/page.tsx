import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ScanFace } from "@bop/icons";
import { PageHeader } from "@bop/ui/components/page-header";

import { FaceKioskDialog } from "../face-kiosk-dialog";

export const metadata: Metadata = {
  title: "Attendance Kiosk",
};

export default function CheckInKioskPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto py-4">
      <Link
        href="/hr/attendance"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Attendance Register
      </Link>

      <PageHeader
        title="AI Face Recognition Attendance Kiosk"
        description="Public/Shared camera kiosk. Employees stand in front of the camera to check IN or OUT."
      />

      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-6 shadow-sm">
        <div className="size-20 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
          <ScanFace className="size-10" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h2 className="text-xl font-bold">Biometric Attendance Check-In</h2>
          <p className="text-sm text-muted-foreground">
            Click the button below to launch the camera kiosk. The system matches your live face
            against enrolled templates to punch your attendance.
          </p>
        </div>

        <div className="pt-2">
          <FaceKioskDialog />
        </div>
      </div>
    </div>
  );
}
