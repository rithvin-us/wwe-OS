"use client";

import { LogOut } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@bop/ui/components/tooltip";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The one sign-out control. Deliberately a single icon button, not a user
 * menu — this platform shows no account chrome (single-operator mode), but
 * a real session still needs a real, honest way to end it.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Sign out"
          onClick={signOut}
          disabled={pending}
        >
          <LogOut aria-hidden className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Sign out</TooltipContent>
    </Tooltip>
  );
}
