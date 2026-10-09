"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { BrandFields } from "@/components/brand-fields";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { saveSettings, saveUser } from "@/app/actions/admin";

type S = {
  storeName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  licenseNo: string;
  ntn: string;
  brandColor: string;
  logoUrl: string | null;
  showLogoOnReceipt: boolean;
  receiptFooter: string;
  nearExpiryDays: number;
};

export function SettingsForm({ s }: { s: S }) {
  return (
    <ActionForm action={saveSettings} className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Branding</h3>
        {/* key: reset the preview after a new logo is saved or removed */}
        <BrandFields key={s.logoUrl ?? "no-logo"} storeName={s.storeName} tagline={s.tagline} brandColor={s.brandColor} logoUrl={s.logoUrl} allowRemove />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Contact & legal (printed on receipts)</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Phone"><Input name="phone" defaultValue={s.phone} /></Field>
          <Field label="Email"><Input name="email" type="email" defaultValue={s.email} /></Field>
          <Field label="Address"><Input name="address" defaultValue={s.address} /></Field>
          <Field label="Drug license no."><Input name="licenseNo" defaultValue={s.licenseNo} /></Field>
          <Field label="NTN / STRN"><Input name="ntn" defaultValue={s.ntn} /></Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Receipt & alerts</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Receipt footer" className="md:col-span-2"><Textarea name="receiptFooter" defaultValue={s.receiptFooter} /></Field>
          <div className="space-y-3">
            <Field label="Near-expiry alert (days)"><Input name="nearExpiryDays" type="number" min={1} defaultValue={s.nearExpiryDays} /></Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="showLogoOnReceipt" defaultChecked={s.showLogoOnReceipt} className="size-4 accent-brand-600" /> Print logo on receipt
            </label>
          </div>
        </div>
      </section>

      <SubmitButton>Save settings</SubmitButton>
    </ActionForm>
  );
}

type U = { id?: string; name?: string; username?: string; role?: string; active?: boolean };

export function UserForm({ u = {} }: { u?: U }) {
  return (
    <ActionForm action={saveUser} resetOnSuccess={!u.id} className="grid items-end gap-2 md:grid-cols-6">
      {u.id && <input type="hidden" name="id" value={u.id} />}
      <Field label="Name"><Input name="name" defaultValue={u.name} required /></Field>
      <Field label="Username"><Input name="username" defaultValue={u.username} required autoCapitalize="none" /></Field>
      <Field label="Role">
        <Select name="role" defaultValue={u.role ?? "CASHIER"}>
          <option value="CASHIER">Cashier</option>
          <option value="PHARMACIST">Pharmacist</option>
          <option value="ADMIN">Admin</option>
        </Select>
      </Field>
      <Field label={u.id ? "New password (optional)" : "Password"}><Input name="password" type="password" required={!u.id} autoComplete="new-password" /></Field>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={u.active ?? true} className="size-4 accent-brand-600" /> Active
      </label>
      <SubmitButton variant={u.id ? "secondary" : "primary"}>{u.id ? "Update" : "Add user"}</SubmitButton>
    </ActionForm>
  );
}
