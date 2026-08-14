import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";

import { CompanyForm } from "@/app/(platform)/settings/company-form";
import { PasswordForm } from "@/app/(platform)/settings/password-form";
import { ProfileForm } from "@/app/(platform)/settings/profile-form";
import { getCompany, getMyProfile } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const [profile, company] = await Promise.all([getMyProfile(), getCompany()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your profile, your company details, and security."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your profile</CardTitle>
          <CardDescription>How you appear and your personal preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      {company ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company</CardTitle>
            <CardDescription>
              Your company details, used across the platform and on reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm basics={company.basics} profile={company.profile} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Change the password you use to sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legal</CardTitle>
          <CardDescription>
            What the platform collects and how it's used, including the attendance kiosk's face and
            location capture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/privacy" className="text-sm font-medium text-primary hover:underline">
            View privacy policy
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
