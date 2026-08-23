import type { Metadata } from "next";
import Link from "next/link";

import { COMPANY } from "@/config/company";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

/**
 * Public, unauthenticated by design — the /checkin kiosk collects a face
 * scan and location from people before they've signed in, so the policy
 * covering that has to be reachable without signing in too.
 */
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-svh bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <p className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
            {COMPANY.name}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            Privacy Policy
          </h1>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <p>
            {COMPANY.name} is an internal operations platform used to run this company — it is not a
            public product, and this page is not a legal contract for customers. It exists because
            the attendance check-in kiosk collects a face scan and, where permitted, location data
            from people before they sign in, and anyone asked to use it is entitled to know what
            that involves.
          </p>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold tracking-tight">
              What the platform holds
            </h2>
            <p className="text-muted-foreground">
              Employee records (name, contact details, role, statutory identifiers), attendance and
              payroll history, expense claims, and business documents such as contracts and purchase
              records. All of it is company operational data, used only to run the company&apos;s
              HR, payroll, and operations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Face check-in and location
            </h2>
            <p className="text-muted-foreground">
              The attendance kiosk captures a short burst of camera frames to confirm the person
              checking in is who they claim to be, and matches it against the photo on file for that
              employee. A best-effort device location is also captured, used only to confirm the
              check-in happened near a work site. Both are used solely to verify and record an
              attendance event — they are not used for any other purpose.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold tracking-tight">Who can see it</h2>
            <p className="text-muted-foreground">
              This company runs {COMPANY.name} as a single-operator platform: the Owner account
              administers HR, accounts, and IT, and is the only account with access to employee
              data. There are no external users, vendors, or advertisers with access to this data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold tracking-tight">Where it lives</h2>
            <p className="text-muted-foreground">
              Data stays on infrastructure operated for this company and is not shared with or sold
              to third parties. It is not indexed by search engines.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold tracking-tight">Questions</h2>
            <p className="text-muted-foreground">
              For questions about your data, contact the company administrator directly.
            </p>
          </section>
        </div>

        <Link href="/" className="inline-block text-sm text-muted-foreground hover:text-foreground">
          ← Back to {COMPANY.name}
        </Link>
      </div>
    </div>
  );
}
