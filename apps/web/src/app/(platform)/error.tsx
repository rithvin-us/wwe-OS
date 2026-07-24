"use client";

import { useEffect } from "react";
import { TriangleAlert } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { EmptyState } from "@bop/ui/components/empty-state";
import Link from "next/link";

/**
 * Platform-wide error boundary — no error.tsx existed anywhere in the
 * (platform) route tree, so a render error had no graceful catch. Sits
 * inside layout.tsx (the sidebar/header stay up, only the content area
 * shows this) and never surfaces stack traces or technical detail to the
 * operator — that's what error.digest is for, matched against server logs.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={TriangleAlert}
      title="Something went wrong"
      description="This page hit a snag loading. It's usually temporary — try again, or head back to the dashboard."
      className="py-20"
      action={
        <div className="flex items-center justify-center gap-2">
          <Button onClick={() => unstable_retry()}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go to dashboard</Link>
          </Button>
        </div>
      }
    />
  );
}
