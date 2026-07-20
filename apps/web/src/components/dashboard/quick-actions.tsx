import { Button } from "@bop/ui/components/button";
import Link from "next/link";

import { QUICK_ACTIONS } from "@/config/dashboard";

/**
 * Quick actions — the few things people start most often. Real navigation
 * into the relevant area; each says exactly what it does.
 */
export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_ACTIONS.map((action) => (
        <Button key={action.href + action.label} asChild variant="outline" size="sm">
          <Link href={action.href}>
            <action.icon aria-hidden />
            {action.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
