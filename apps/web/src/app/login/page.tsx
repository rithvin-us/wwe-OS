import type { Metadata } from "next";
import { Skeleton } from "@bop/ui/components/skeleton";
import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";
import { LoginFeatureShowcase } from "@/components/login-feature-showcase";
import { COMPANY } from "@/config/company";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlatformStatusBadge } from "@/components/platform-status-badge";

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's "%s · WWE OS" template. Without
  // it this page rendered as "Employee Sign In | WWE OS · WWE OS" — the name
  // twice, behind a label. The tab should read as the product, not the task.
  title: { absolute: COMPANY.name },
  description: `Sign in to ${COMPANY.name}.`,
};

/**
 * The one login page. Every app authenticates through this surface —
 * platform/auth is the only identity provider.
 *
 * A scene on the left (real plant photography), the form on the right. The
 * form sits on the panel itself: a card floating on a split is a second
 * frame around content that already has one.
 */
export default function LoginPage() {
  return (
    <div className="relative min-h-svh bg-background font-sans antialiased">
      <header className="absolute top-0 right-0 z-30 flex items-center gap-4 p-6">
        {/* One status indicator, not one per breakpoint. */}
        <span className="hidden items-center gap-2 sm:flex">
          <PlatformStatusBadge />
        </span>
        <ThemeToggle />
      </header>

      <div className="grid min-h-svh w-full lg:grid-cols-12">
        {/* The scene: what the company actually operates. */}
        <div className="hidden border-r border-border lg:col-span-7 lg:block">
          <LoginFeatureShowcase />
        </div>

        {/* Sign-in */}
        <div className="col-span-12 flex flex-col justify-between p-6 sm:p-10 lg:col-span-5 lg:p-12">
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary font-display text-base font-semibold text-primary-foreground">
                {COMPANY.mark}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-lg font-medium tracking-tight text-foreground">
                  {COMPANY.name}
                </span>
                <span className="block text-xs text-muted-foreground">{COMPANY.caption}</span>
              </span>
            </div>

            <div className="mt-10 space-y-1.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Sign in
              </h1>
              <p className="text-sm text-muted-foreground">
                Use your email and password, or sign in with your face
              </p>
            </div>

            <div className="mt-8">
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <LoginForm />
              </Suspense>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} {COMPANY.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
