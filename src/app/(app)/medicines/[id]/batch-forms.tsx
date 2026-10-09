"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Select } from "@/components/ui";
import { adjustStockAction, openingStockAction, updateBatchAction } from "@/app/actions/medicines";

type Med = { id: string; unitsPerPack: number; packName: string; unitName: string; salePrice: number };

export function OpeningStockForm({ med }: { med: Med }) {
  return (
    <ActionForm action={openingStockAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="medicineId" value={med.id} />
      <Field label="Batch no. *"><Input name="batchNo" required /></Field>
      <Field label="Expiry date *"><Input name="expiryDate" type="date" required /></Field>
      <Field label={`Cost / ${med.packName} (Rs)`}><Input name="costPrice" type="number" step="0.01" min={0} required /></Field>
      <Field label={`Sale / ${med.packName} (Rs)`}><Input name="salePrice" type="number" step="0.01" min={0} defaultValue={med.salePrice || ""} required /></Field>
      <Field label={`Qty (${med.packName})`}><Input name="packs" type="number" min={0} defaultValue={0} /></Field>
      {med.unitsPerPack > 1 && <Field label={`+ Loose (${med.unitName})`}><Input name="units" type="number" min={0} defaultValue={0} /></Field>}
      <div className="flex items-end sm:col-span-2 lg:col-span-1"><SubmitButton>Add stock</SubmitButton></div>
    </ActionForm>
  );
}

export function AdjustForm({ med, batch }: { med: Med; batch: { id: string; salePrice: number; expiry: string } }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ActionForm action={adjustStockAction} resetOnSuccess className="space-y-2">
        <p className="text-xs font-semibold text-slate-700">Adjust quantity</p>
        <input type="hidden" name="batchId" value={batch.id} />
        <input type="hidden" name="medicineId" value={med.id} />
        <input type="hidden" name="unitsPerPack" value={med.unitsPerPack} />
        <div className="flex gap-2">
          <Select name="direction" className="w-28"><option value="remove">Remove</option><option value="add">Add</option></Select>
          <Select name="type" className="w-36"><option value="ADJUSTMENT">Adjustment</option><option value="EXPIRED">Expired / Damaged</option></Select>
        </div>
        <div className="flex gap-2">
          <Input name="packs" type="number" min={0} placeholder={med.packName} />
          {med.unitsPerPack > 1 && <Input name="units" type="number" min={0} placeholder={med.unitName} />}
        </div>
        <Input name="note" placeholder="Reason (e.g. broken, count correction)" />
        <SubmitButton variant="secondary">Apply</SubmitButton>
      </ActionForm>
      <ActionForm action={updateBatchAction} className="space-y-2">
        <p className="text-xs font-semibold text-slate-700">Edit batch</p>
        <input type="hidden" name="batchId" value={batch.id} />
        <input type="hidden" name="medicineId" value={med.id} />
        <Field label={`Sale price / ${med.packName}`}><Input name="salePrice" type="number" step="0.01" min={0} defaultValue={batch.salePrice} /></Field>
        <Field label="Expiry"><Input name="expiryDate" type="date" defaultValue={batch.expiry} /></Field>
        <SubmitButton variant="secondary">Update</SubmitButton>
      </ActionForm>
    </div>
  );
}
