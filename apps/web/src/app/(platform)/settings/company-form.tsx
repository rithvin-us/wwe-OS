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
      {/* Organization Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-foreground">{basics.name || "WWE OS"}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                ACTIVE TENANT
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Official company profile & financial settings used across invoices, reports, and
              purchase orders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono font-semibold bg-background/60 px-3 py-1.5 rounded-lg border border-border/40">
          <span>CURRENCY: {basics.currency || "USD"}</span>
        </div>
      </div>

      {/* Sub-Section 1: Organization Identity */}
      <div className="space-y-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 pb-1 border-b border-border/40">
          <Building2 className="h-3.5 w-3.5 text-indigo-400" />
          Organization Identity & Currency
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-name" className="text-xs font-semibold flex items-center gap-1.5">
              Company Display Name
            </Label>
            <Input
              id="c-name"
              name="name"
              defaultValue={basics.name}
              required
              placeholder="e.g. WWE OS"
              className="text-xs font-medium"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-legal" className="text-xs font-semibold flex items-center gap-1.5">
              Legal Registered Entity Name
            </Label>
            <Input
              id="c-legal"
              name="legal_name"
              defaultValue={profile.legal_name}
              placeholder="e.g. Water Works Engineering LLC"
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
              placeholder="USD"
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
              placeholder="UTC"
              className="text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Sub-Section 2: Contact & Headquarters */}
      <div className="space-y-4 pt-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 pb-1 border-b border-border/40">
          <MapPin className="h-3.5 w-3.5 text-indigo-400" />
          Tax, Contact & Location
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-reg" className="text-xs font-semibold flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Tax / Registration Number
            </Label>
            <Input
              id="c-reg"
              name="registration_number"
              defaultValue={profile.registration_number}
              placeholder="Tax Registration / EIN / VAT"
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-email" className="text-xs font-semibold flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Official Billing Email
            </Label>
            <Input
              id="c-email"
              name="contact_email"
              type="email"
              defaultValue={profile.contact_email}
              placeholder="billing@company.local"
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
              placeholder="US"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="c-address" className="text-xs font-semibold flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Headquarters Street Address
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
      </div>

      <div className="flex justify-end pt-2 border-t border-border/40">
        <Button
          type="submit"
          disabled={pending}
          className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md"
        >
          <Save className="h-3.5 w-3.5" />
          {pending ? "Saving..." : "Save Company Details"}
        </Button>
      </div>
    </form>
  );
}
