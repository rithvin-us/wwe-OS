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
    <div className="space-y-8">
      <PageHeader
        title="Settings & System Architecture"
        description="Manage your user profile, biometric face enrollment, company details, and monitor live platform architecture topology."
      />

      {/* Interactive System Topology Diagram */}
      <SettingsTopologyDiagram />

      {/* Profile Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Profile</CardTitle>
          <CardDescription>
            How you appear across the workspace and your personal preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      {/* Biometric Face ID Registration & AI Engine Status */}
      <FaceEnrollmentCard />

      {/* Company Profile Configuration */}
      {company ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Company & Tenant Details</CardTitle>
            <CardDescription>
              Your company details used across purchase orders, documents, invoices, and reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm basics={company.basics} profile={company.profile} />
          </CardContent>
        </Card>
      ) : null}

      {/* Security & Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security & Authentication</CardTitle>
          <CardDescription>
            Change your account password and review device authentication policies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      {/* Legal & Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legal & Privacy Compliance</CardTitle>
          <CardDescription>
            What the platform collects and how biometric face templates and location metadata are
            securely handled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/privacy" className="text-sm font-medium text-primary hover:underline">
            View platform privacy policy & data retention terms →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
