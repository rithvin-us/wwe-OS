import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";
import { COMPANY } from "@/config/company";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * The one login page. Every app authenticates through this surface —
 * platform/auth is the only identity provider.
 */
export default function LoginPage() {
  return (
    <div className="grid min-h-svh place-items-center bg-background px-4">
      <div className="animate-in fade-in slide-in-from-bottom-2 w-full max-w-sm duration-(--duration-slow) ease-out-quart">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary font-display text-sm font-semibold text-primary-foreground">
            {COMPANY.mark}
          </span>
          <div>
            <p className="font-display text-base font-semibold tracking-tight">{COMPANY.name}</p>
            <p className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
              {COMPANY.caption}
            </p>
          </div>
        </div>

        <h1 className="mb-1 font-display text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          One account for everything you use here.
        </p>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
