"use client";

import { Package } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Select } from "@/components/ui";
import { ComboboxInput } from "@/components/combobox-input";
import { saveMedicine } from "@/app/actions/medicines";

export const FORMS = ["Tablet", "Capsule", "Syrup", "Suspension", "Injection", "Drops", "Cream", "Ointment", "Gel", "Inhaler", "Sachet", "Effervescent", "Suppository", "Infusion", "Surgical", "Other"];

const PACKS = ["Strip", "Box", "Bottle", "Tube", "Vial", "Ampoule", "Pack", "Piece"];
const UNITS = ["Tablet", "Capsule", "Bottle", "Piece", "Sachet", "Vial", "Ampoule", "Tube"];

type MedicineValues = {
  id?: string;
  name?: string;
  genericName?: string | null;
  form?: string;
  strength?: string | null;
  barcode?: string | null;
  category?: string | null;
  manufacturer?: string | null;
  unitName?: string;
  packName?: string;
  unitsPerPack?: number;
  salePrice?: number;
  reorderPacks?: number;
  rackLocation?: string | null;
  allowLooseSale?: boolean;
  requiresPrescription?: boolean;
  isControlled?: boolean;
  hasStock?: boolean;
};

export function MedicineForm({ values = {}, categories, manufacturers }: { values?: MedicineValues; categories: string[]; manufacturers: string[] }) {
  const v = values;
  return (
    <ActionForm action={saveMedicine} className="space-y-6">
      {v.id && <input type="hidden" name="id" value={v.id} />}

      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Basic info</legend>
        <Field label="Brand name *"><Input name="name" defaultValue={v.name} required placeholder="e.g. Panadol" /></Field>
        <Field label="Generic / Salt" hint="Used to suggest substitutes"><Input name="genericName" defaultValue={v.genericName ?? ""} placeholder="e.g. Paracetamol" /></Field>
        <Field label="Strength"><Input name="strength" defaultValue={v.strength ?? ""} placeholder="500mg, 120ml" /></Field>
        <Field label="Form">
          <Select name="form" defaultValue={v.form ?? "Tablet"}>
            {FORMS.map((f) => <option key={f}>{f}</option>)}
          </Select>
        </Field>
        <Field label="Category">
          <ComboboxInput name="category" defaultValue={v.category ?? ""} options={categories} placeholder="Select or type new" />
        </Field>
        <Field label="Company / Manufacturer">
          <ComboboxInput name="manufacturer" defaultValue={v.manufacturer ?? ""} options={manufacturers} placeholder="Select or type new" />
        </Field>
        <Field label="Barcode" hint="Scan with barcode reader"><Input name="barcode" defaultValue={v.barcode ?? ""} /></Field>
        <Field label="Rack / Shelf"><Input name="rackLocation" defaultValue={v.rackLocation ?? ""} placeholder="e.g. R2-B" /></Field>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-4">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Packing & price</legend>
        <Field label="Pack name" hint="How it is bought / sold as a pack">
          <ComboboxInput name="packName" defaultValue={v.packName ?? "Strip"} options={PACKS} required />
        </Field>
        <Field label="Loose unit name" hint="Smallest unit you sell">
          <ComboboxInput name="unitName" defaultValue={v.unitName ?? "Tablet"} options={UNITS} required />
        </Field>
        <Field label="Units per pack" hint={v.hasStock ? "Locked: stock exists" : "e.g. 10 tablets in a strip"}>
          <Input name="unitsPerPack" type="number" min={1} defaultValue={v.unitsPerPack ?? 10} required readOnly={v.hasStock} />
        </Field>
        <Field label="Sale price per pack (Rs)" hint="New purchases update this"><Input name="salePrice" type="number" step="0.01" min={0} defaultValue={v.salePrice ?? ""} /></Field>
        <Field label="Reorder level (packs)" hint="Alert when stock falls to this"><Input name="reorderPacks" type="number" step="0.1" min={0} defaultValue={v.reorderPacks ?? 0} /></Field>
      </fieldset>

      {!v.id && (
        <fieldset className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 md:grid-cols-4">
          <legend className="px-1 text-sm font-semibold text-emerald-900 flex items-center gap-1.5">
            <Package className="size-4 text-emerald-700" /> Initial Stock (Optional)
          </legend>
          <Field label="Initial stock (packs)" hint="Stock currently on shelf">
            <Input name="initialPacks" type="number" min={0} placeholder="e.g. 10" />
          </Field>
          <Field label="Cost price per pack (Rs)" hint="Purchase / cost price">
            <Input name="initialCostPrice" type="number" step="0.01" min={0} placeholder="e.g. 80" />
          </Field>
          <Field label="Batch No" hint="Auto-generated if empty">
            <Input name="batchNo" placeholder="e.g. B-101" />
          </Field>
          <Field label="Expiry date">
            <Input name="expiryDate" type="date" />
          </Field>
        </fieldset>
      )}

      <fieldset className="flex flex-wrap gap-6 text-sm">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Options</legend>
        <label className="flex items-center gap-2"><input type="checkbox" name="allowLooseSale" defaultChecked={v.allowLooseSale ?? true} className="size-4 accent-brand-600" /> Allow loose sale (single tablets)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="requiresPrescription" defaultChecked={v.requiresPrescription} className="size-4 accent-brand-600" /> Prescription required</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isControlled" defaultChecked={v.isControlled} className="size-4 accent-brand-600" /> Controlled / narcotic</label>
      </fieldset>

      <SubmitButton>{v.id ? "Save changes" : "Add medicine"}</SubmitButton>
    </ActionForm>
  );
}
