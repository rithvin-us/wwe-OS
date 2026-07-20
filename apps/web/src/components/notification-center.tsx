"use client";

import { Bell } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { EmptyState } from "@bop/ui/components/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@bop/ui/components/popover";
import { Separator } from "@bop/ui/components/separator";

/**
 * The one notification center. Every app publishes into this surface —
 * no app ships its own bell.
 */
export function NotificationCenter() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications">
          <Bell aria-hidden className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
        </div>
        <Separator />
        <div className="p-3">
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            description="Updates from your apps will appear here."
            className="border-0 py-8"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
