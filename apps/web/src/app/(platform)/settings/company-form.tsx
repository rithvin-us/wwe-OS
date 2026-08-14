"use client";

import { type FormEvent, useTransition } from "react";
import {
  Building2,
  FileText,
  CreditCard,
  Clock,
  Mail,
  Phone,
  MapPin,
  Globe,
  Save,
} from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
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
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="c-name" className="text-xs font-semibold flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            Company Display Name
          </Label>
          <Input
            id="c-name"
            name="name"
            defaultValue={basics.name}
            required
            className="text-xs font-medium"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-legal" className="text-xs font-semibold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            Legal Registered Entity Name
          </Label>
          <Input
            id="c-legal"
            name="legal_name"
            defaultValue={profile.legal_name}
            placeholder="e.g. Water Works Engineering Ltd."
            className="text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-currency" className="text-xs font-semibold flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            Base Currency (3-Letter ISO)
          </Label>
          <Input
            id="c-currency"
            name="currency"
            defaultValue={basics.currency}
            maxLength={3}
            className="uppercase text-xs font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-timezone" className="text-xs font-semibold flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            Organization Timezone
          </Label>
          <Input
            id="c-timezone"
            name="timezone"
            defaultValue={basics.timezone}
            className="text-xs font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-reg" className="text-xs font-semibold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            Tax / Registration Number
          </Label>
          <Input
            id="c-reg"
            name="registration_number"
            defaultValue={profile.registration_number}
            placeholder="Tax ID or Business Reg. No."
            className="text-xs font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-email" className="text-xs font-semibold flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            Official Contact Email
          </Label>
          <Input
            id="c-email"
            name="contact_email"
            type="email"
            defaultValue={profile.contact_email}
            placeholder="contact@company.com"
            className="text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-phone" className="text-xs font-semibold flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            Contact Phone Number
          </Label>
          <Input
            id="c-phone"
            name="phone"
            defaultValue={profile.phone}
            placeholder="+1 (555) 000-0000"
            className="text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-country" className="text-xs font-semibold flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            Country Code (2-Letter)
          </Label>
          <Input
            id="c-country"
            name="country"
            defaultValue={profile.country}
            maxLength={2}
            className="uppercase text-xs font-mono"
            placeholder="US / IN / GB"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="c-address" className="text-xs font-semibold flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            Street Address & Headquarters
          </Label>
          <Input
            id="c-address"
            name="address_line1"
            defaultValue={profile.address_line1}
            placeholder="Street address, suite, or building"
            className="text-xs"
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
          {pending ? "Saving..." : "Save Company Details"}
        </Button>
      </div>
    </form>
  );
}
