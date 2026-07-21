"use client";

import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { type FormEvent, useTransition } from "react";
import { toast } from "sonner";

import { saveCompanyAction } from "@/app/(platform)/settings/actions";
import type { CompanyBasics, CompanyProfile } from "@/lib/settings";

export function CompanyForm({
  basics,
  profile,
}: {
  basics: CompanyBasics;
  profile: CompanyProfile;
}) {
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();
    startTransition(async () => {
      const result = await saveCompanyAction(
        {
          name: get("name") || basics.name,
          currency: (get("currency") || basics.currency).toUpperCase(),
          timezone: get("timezone") || basics.timezone,
        },
        {
          legal_name: get("legal_name"),
          registration_number: get("registration_number"),
          contact_email: get("contact_email"),
          phone: get("phone"),
          address_line1: get("address_line1"),
          city: get("city"),
          country: get("country").toUpperCase(),
        },
      );
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Company name</Label>
          <Input id="c-name" name="name" defaultValue={basics.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-legal">Legal name</Label>
          <Input
            id="c-legal"
            name="legal_name"
            defaultValue={profile.legal_name}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-currency">Currency</Label>
          <Input
            id="c-currency"
            name="currency"
            defaultValue={basics.currency}
            maxLength={3}
            className="uppercase"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-timezone">Timezone</Label>
          <Input id="c-timezone" name="timezone" defaultValue={basics.timezone} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-reg">Registration number</Label>
          <Input
            id="c-reg"
            name="registration_number"
            defaultValue={profile.registration_number}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-email">Contact email</Label>
          <Input
            id="c-email"
            name="contact_email"
            type="email"
            defaultValue={profile.contact_email}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-phone">Contact phone</Label>
          <Input id="c-phone" name="phone" defaultValue={profile.phone} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-address">Address</Label>
          <Input
            id="c-address"
            name="address_line1"
            defaultValue={profile.address_line1}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-city">City</Label>
          <Input id="c-city" name="city" defaultValue={profile.city} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-country">Country (2-letter)</Label>
          <Input
            id="c-country"
            name="country"
            defaultValue={profile.country}
            maxLength={2}
            className="uppercase"
            placeholder="Optional"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          Save company details
        </Button>
      </div>
    </form>
  );
}
