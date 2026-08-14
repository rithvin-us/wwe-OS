"use client";

import { type FormEvent, useTransition } from "react";
import { User, Mail, Phone, Clock, Globe, Save, ShieldCheck } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
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

  const initials = profile.username ? profile.username.slice(0, 2).toUpperCase() : "AD";

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Profile Header Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold text-lg shadow-inner">
            {initials}
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-slate-950">
              ✓
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-foreground">{profile.username}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {profile.status ? profile.status.toUpperCase() : "ACTIVE"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{profile.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium bg-background/60 px-3 py-1.5 rounded-lg border border-border/40">
          <ShieldCheck className="h-4 w-4" />
          <span>Platform Owner Permission</span>
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="p-username" className="text-xs font-semibold flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            Username
          </Label>
          <Input
            id="p-username"
            value={profile.username}
            disabled
            className="bg-muted/40 font-mono text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-email" className="text-xs font-semibold flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            Work Email Address
          </Label>
          <Input
            id="p-email"
            value={profile.email}
            disabled
            className="bg-muted/40 font-mono text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-phone" className="text-xs font-semibold flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            Contact Phone
          </Label>
          <Input
            id="p-phone"
            name="phone"
            defaultValue={profile.phone}
            placeholder="+1 (555) 000-0000"
            className="text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-timezone" className="text-xs font-semibold flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            Primary Timezone
          </Label>
          <Input
            id="p-timezone"
            name="timezone"
            defaultValue={profile.timezone || "UTC"}
            className="text-xs font-mono"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="p-language" className="text-xs font-semibold flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            Interface Language
          </Label>
          <Input
            id="p-language"
            name="language"
            defaultValue={profile.language || "en-us"}
            className="text-xs font-mono"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-border/40">
        <Button
          type="submit"
          disabled={pending}
          className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs"
        >
          <Save className="h-3.5 w-3.5" />
          {pending ? "Saving..." : "Save Profile Changes"}
        </Button>
      </div>
    </form>
  );
}
