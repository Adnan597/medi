"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { ActionForm, SubmitButton } from "./action-form";
import { Button, Field, Input, Select } from "./ui";
import { recordPayment, saveCustomer, saveSupplier } from "@/app/actions/parties";

type Party = { id?: string; name?: string; phone?: string | null; address?: string | null; contactPerson?: string | null; creditLimit?: number };

export function SupplierForm({ s = {}, onSuccess }: { s?: Party; onSuccess?: () => void }) {
  return (
    <ActionForm action={saveSupplier} resetOnSuccess={!s.id} onSuccess={onSuccess} className="grid gap-3 md:grid-cols-2">
      {s.id && <input type="hidden" name="id" value={s.id} />}
      <Field label="Name *"><Input name="name" defaultValue={s.name} required /></Field>
      <Field label="Contact person"><Input name="contactPerson" defaultValue={s.contactPerson ?? ""} /></Field>
      <Field label="Phone"><Input name="phone" defaultValue={s.phone ?? ""} /></Field>
      <Field label="Address"><Input name="address" defaultValue={s.address ?? ""} /></Field>
      {!s.id && <Field label="Opening balance (you owe)" hint="Old dues before using this software"><Input name="opening" type="number" step="0.01" /></Field>}
      <div className="flex items-end"><SubmitButton>{s.id ? "Save" : "Add supplier"}</SubmitButton></div>
    </ActionForm>
  );
}

export function CustomerForm({ c = {}, onSuccess }: { c?: Party; onSuccess?: () => void }) {
  return (
    <ActionForm action={saveCustomer} resetOnSuccess={!c.id} onSuccess={onSuccess} className="grid gap-3 md:grid-cols-2">
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <Field label="Name *"><Input name="name" defaultValue={c.name} required /></Field>
      <Field label="Phone"><Input name="phone" defaultValue={c.phone ?? ""} /></Field>
      <Field label="Address"><Input name="address" defaultValue={c.address ?? ""} /></Field>
      <Field label="Credit limit (Rs)" hint="0 = no limit"><Input name="creditLimit" type="number" min={0} defaultValue={c.creditLimit ?? 0} /></Field>
      {!c.id && <Field label="Opening balance (they owe)"><Input name="opening" type="number" step="0.01" /></Field>}
      <div className="flex items-end"><SubmitButton>{c.id ? "Save" : "Add customer"}</SubmitButton></div>
    </ActionForm>
  );
}

export function EditSupplierButton({ s }: { s: Party }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="px-2.5 py-1 text-xs">
        <Pencil className="size-3.5" /> Edit
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 text-left shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-semibold text-slate-800">Edit Supplier: {s.name}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>
            <SupplierForm s={s} onSuccess={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

export function EditCustomerButton({ c }: { c: Party }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="px-2.5 py-1 text-xs">
        <Pencil className="size-3.5" /> Edit
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 text-left shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-semibold text-slate-800">Edit Customer: {c.name}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>
            <CustomerForm c={c} onSuccess={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

export function PaymentForm({ party, id, isAdmin }: { party: "supplier" | "customer"; id: string; isAdmin: boolean }) {
  return (
    <ActionForm action={recordPayment} resetOnSuccess className="space-y-3">
      <input type="hidden" name="party" value={party} />
      <input type="hidden" name="id" value={id} />
      {isAdmin && (
        <Field label="Type">
          <Select name="kind">
            <option value="payment">{party === "supplier" ? "Payment to supplier" : "Payment received"}</option>
            <option value="adjust">Balance adjustment (+/-)</option>
          </Select>
        </Field>
      )}
      <Field label="Amount (Rs)"><Input name="amount" type="number" step="0.01" required /></Field>
      <Field label="Note"><Input name="note" placeholder="Cash / cheque no. / bank" /></Field>
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}
