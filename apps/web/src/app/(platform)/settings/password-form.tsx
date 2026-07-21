"use client";

import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { changePasswordAction } from "@/app/(platform)/settings/actions";

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = String(form.get("current_password") ?? "");
    const next = String(form.get("new_password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await changePasswordAction({ current_password: current, new_password: next });
      if (result.ok) {
        toast.success(result.message);
        formRef.current?.reset();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="s-current">Current password</Label>
          <Input
            id="s-current"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-new">New password</Label>
          <Input
            id="s-new"
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-confirm">Confirm new password</Label>
          <Input
            id="s-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          Change password
        </Button>
      </div>
    </form>
  );
}
