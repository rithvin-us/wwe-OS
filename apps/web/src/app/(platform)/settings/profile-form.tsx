"use client";

import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { type FormEvent, useTransition } from "react";
import { toast } from "sonner";

import { updateProfileAction } from "@/app/(platform)/settings/actions";
import type { MyProfile } from "@/lib/settings";

export function ProfileForm({ profile }: { profile: MyProfile }) {
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateProfileAction({
        phone: String(form.get("phone") ?? ""),
        timezone: String(form.get("timezone") ?? "UTC").trim() || "UTC",
        language: String(form.get("language") ?? "en-us").trim() || "en-us",
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="p-username">Username</Label>
          <Input id="p-username" value={profile.username} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-email">Email</Label>
          <Input id="p-email" value={profile.email} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-phone">Phone</Label>
          <Input id="p-phone" name="phone" defaultValue={profile.phone} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-timezone">Timezone</Label>
          <Input id="p-timezone" name="timezone" defaultValue={profile.timezone} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-language">Language</Label>
          <Input id="p-language" name="language" defaultValue={profile.language} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
