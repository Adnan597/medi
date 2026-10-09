"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { BrandFields } from "@/components/brand-fields";
import { Card, Field, Input } from "@/components/ui";
import { completeSetup } from "@/app/actions/setup";

type Preset = { storeName: string; tagline: string; brandColor: string; logoUrl: string | null; phone: string; licenseNo: string; address: string };

/** Pre-filled with whatever is already in the DB (e.g. branding set up before handover). */
export function SetupForm({ preset }: { preset: Preset }) {
  return (
    <ActionForm action={completeSetup} className="space-y-5">
      <Card title="1. Pharmacy & branding">
        <BrandFields storeName={preset.storeName} tagline={preset.tagline} brandColor={preset.brandColor} logoUrl={preset.logoUrl} />
      </Card>

      <Card title="2. Contact details (printed on receipts)">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Phone"><Input name="phone" defaultValue={preset.phone} /></Field>
          <Field label="Drug license no."><Input name="licenseNo" defaultValue={preset.licenseNo} /></Field>
          <Field label="Address"><Input name="address" defaultValue={preset.address} /></Field>
        </div>
      </Card>

      <Card title="3. Admin account">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your name *"><Input name="adminName" required /></Field>
          <Field label="Username *" hint="Used to log in"><Input name="username" required autoCapitalize="none" autoComplete="username" /></Field>
          <Field label="Password *"><Input name="password" type="password" required minLength={6} autoComplete="new-password" /></Field>
          <Field label="Confirm password *"><Input name="confirm" type="password" required minLength={6} autoComplete="new-password" /></Field>
        </div>
      </Card>

      <SubmitButton className="h-11 w-full text-base" pendingText="Setting up…">Finish setup</SubmitButton>
    </ActionForm>
  );
}
