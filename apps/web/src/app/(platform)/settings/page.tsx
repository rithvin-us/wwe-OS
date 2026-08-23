import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@bop/ui/components/page-header";

import { SettingsWorkspace } from "@/app/(platform)/settings/settings-workspace";
import { getCompany, getMyProfile } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const [profile, company] = await Promise.all([getMyProfile(), getCompany()]);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Settings & Governance"
        description="Manage your account profile, biometric face enrollment, organization details, security rules, and platform architecture topology."
      />

      {/* Tabbed Executive Settings Workspace */}
      <SettingsWorkspace profile={profile} company={company} />

      {/* Footer Legal Link */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/40">
        <span>WWE OS Operations Platform</span>
        <Link href="/privacy" className="hover:text-foreground hover:underline font-medium">
          Platform Privacy Policy & Biometric Compliance →
        </Link>
      </div>
    </div>
  );
}
