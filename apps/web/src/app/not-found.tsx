import { Compass } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { EmptyState } from "@bop/ui/components/empty-state";
import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

/**
 * Root 404 boundary — catches both unmatched top-level routes and any
 * notFound() call inside (platform) (e.g. a bad record id), since no more
 * specific not-found.tsx exists in that segment to intercept first.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="This page doesn't exist or may have moved. Check the link, or head back to the dashboard."
        className="py-20"
        action={
          <Button asChild>
            <Link href="/">Go to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
