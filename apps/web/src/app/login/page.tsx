import type { Metadata } from "next";
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
 */
export default function LoginPage() {
  return (
    <div className="relative min-h-svh bg-background font-sans antialiased">
      {/* Top Action Bar */}
      <header className="absolute top-0 right-0 z-30 flex items-center gap-3 p-4 md:p-6">
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1.5 backdrop-blur-md shadow-xs">
          <PlatformStatusBadge />
        </div>
        <ThemeToggle />
      </header>

      {/* Main Split Container */}
      <div className="grid min-h-svh w-full lg:grid-cols-12">
        {/* Left Side: STP Facilities & Operational Highlights */}
        <div className="hidden lg:col-span-7 lg:block border-r border-border/40">
          <LoginFeatureShowcase />
        </div>

        {/* Right Side: Employee Auth Form */}
        <div className="col-span-12 flex flex-col justify-between p-6 sm:p-10 lg:col-span-5 lg:p-12">
          {/* Top Logo / Brand Header */}
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary font-display text-base font-bold text-primary-foreground shadow-md">
                  {COMPANY.mark}
                </span>
                <div>
                  <p className="font-display text-lg font-bold tracking-tight text-foreground">
                    {COMPANY.name}
                  </p>
                  <p className="font-mono text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                    {COMPANY.caption}
                  </p>
                </div>
              </div>

              {/* Mobile System Status Badge */}
              <div className="flex sm:hidden items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">
                <PlatformStatusBadge variant="short" />
              </div>
            </div>

            {/* Login Card Header */}
            <div className="mb-6 space-y-1.5">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Employee Sign In
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Sign in with your employee account to access operations and plant management.
              </p>
            </div>

            {/* Glassmorphic Form Card Wrapper */}
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 sm:p-7 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:shadow-primary/5 transition duration-(--duration-slow) ease-out-quart">
              <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/40" />}>
                <LoginForm />
              </Suspense>
            </div>
          </div>

          {/* Footer Copyright Notice */}
          <div className="mx-auto mt-8 w-full max-w-sm text-center text-xs text-muted-foreground">
            <p className="text-[11px]">
              &copy; {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
