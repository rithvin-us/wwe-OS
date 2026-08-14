import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";

import { CompanyForm } from "@/app/(platform)/settings/company-form";
import { PasswordForm } from "@/app/(platform)/settings/password-form";
import { ProfileForm } from "@/app/(platform)/settings/profile-form";
import { FaceEnrollmentCard } from "@/app/(platform)/settings/face-enrollment-card";
import { SettingsTopologyDiagram } from "@/app/(platform)/settings/settings-topology-diagram";
import { getCompany, getMyProfile } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const [profile, company] = await Promise.all([getMyProfile(), getCompany()]);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Settings"
        description="Manage your profile, company details, biometric enrollment, and system node architecture."
      />

      {/* High-End System Topology Diagram */}
      <SettingsTopologyDiagram />

      {/* Your Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Your Profile</CardTitle>
          <CardDescription>
            How you appear across the workspace and your personal preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      {/* Owner Face ID Biometric Registration */}
      <FaceEnrollmentCard />

      {/* Company Profile Configuration */}
      {company ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Company</CardTitle>
            <CardDescription>
              Your company details, used across the platform, purchase orders, invoices, and
              reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm basics={company.basics} profile={company.profile} />
          </CardContent>
        </Card>
      ) : null}

      {/* Security & Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Security</CardTitle>
          <CardDescription>
            Change the password you use to sign in across your devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      {/* Legal & Privacy Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Legal</CardTitle>
          <CardDescription>
            What the platform collects and how it's used, including the attendance kiosk's face and
            location capture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/privacy" className="text-sm font-medium text-primary hover:underline">
            View privacy policy →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
