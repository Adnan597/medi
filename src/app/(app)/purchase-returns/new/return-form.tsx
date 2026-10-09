"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { savePurchaseReturn, searchBatches, type ReturnableBatch } from "@/app/actions/purchases";
import { AsyncSearch } from "@/components/async-search";
import { Button, Field, Input, Select } from "@/components/ui";
import { daysUntil, fmtExpiry, fmtQty, money, round2 } from "@/lib/format";

type Line = { batch: ReturnableBatch; units: string; amount: string };

export function PurchaseReturnForm({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const unitCost = (b: ReturnableBatch) => b.costPrice / b.medicine.unitsPerPack;

  const handleSearch = useCallback(
    (q: string) => {
      if (!supplierId) return Promise.resolve([]);
      return searchBatches(q, supplierId);
    },
    [supplierId]
  );

  function add(b: ReturnableBatch) {
    if (lines.some((l) => l.batch.id === b.id)) return;
    setLines((ls) => [...ls, { batch: b, units: String(b.quantity), amount: String(round2(unitCost(b) * b.quantity)) }]);
  }

  async function addAllExpired() {
    if (!supplierId) {
      setError("Please select a supplier first");
      return;
    }
    setError(null);
    const list = await searchBatches(":expired", supplierId);
    if (!list.length) {
      setError("No expired stock found for this supplier");
      return;
    }
    setLines((ls) => {
      const have = new Set(ls.map((l) => l.batch.id));
      return [...ls, ...list.filter((b) => !have.has(b.id)).map((b) => ({ batch: b, units: String(b.quantity), amount: String(round2(unitCost(b) * b.quantity)) }))];
    });
  }

  function handleSupplierChange(id: string) {
    setSupplierId(id);
    setLines([]);
    setError(null);
  }

  const total = round2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));

  function submit() {
    setError(null);
    if (!supplierId) return setError("Please select a supplier");
    if (!lines.length) return setError("Add at least one item to return");
    start(async () => {
      const res = await savePurchaseReturn({
        supplierId, reason: reason || null,
        items: lines.map((l) => ({ batchId: l.batch.id, quantity: Number(l.units) || 0, amount: Number(l.amount) || 0 })),
      });
      if (!res.ok) setError(res.error);
      else router.push("/purchase-returns?saved=1");
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Supplier *">
          <Select value={supplierId} onChange={(e) => handleSupplierChange(e.target.value)}>
            <option value="">Select supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Expired / damaged / excess" /></Field>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[280px] flex-1">
          {!supplierId && <p className="mb-1 text-xs font-medium text-amber-700">Select a supplier above to search their purchased stock</p>}
          <AsyncSearch<ReturnableBatch>
            key={supplierId}
            search={handleSearch}
            onPick={add}
            placeholder={supplierId ? "Search medicine or batch no purchased from this supplier…" : "Select a supplier first…"}
            render={(b) => (
              <div className="flex justify-between gap-2">
                <span><b>{b.medicine.name}</b> {b.medicine.strength} <span className="font-mono text-xs">{b.batchNo}</span></span>
                <span className="text-xs text-slate-500">Exp {fmtExpiry(b.expiryDate)} · {fmtQty(b.quantity, b.medicine.unitsPerPack, b.medicine.packName, b.medicine.unitName)}</span>
              </div>
            )}
          />
        </div>
        <Button variant="secondary" type="button" onClick={addAllExpired}>Add all expired stock</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-semibold uppercase text-slate-500">
            <tr><th className="py-2">Medicine</th><th>Batch / Expiry</th><th>In stock</th><th>Return qty (units)</th><th>Credit amount (Rs)</th><th></th></tr>
          </thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">{supplierId ? "Search and select items to return" : "Select a supplier to begin"}</td></tr>}
            {lines.map((l, i) => {
              const m = l.batch.medicine;
              return (
                <tr key={l.batch.id} className="border-t border-slate-100">
                  <td className="py-2">{m.name} {m.strength}</td>
                  <td><span className="font-mono text-xs">{l.batch.batchNo}</span> · <span className={daysUntil(l.batch.expiryDate) <= 0 ? "text-red-600" : ""}>{fmtExpiry(l.batch.expiryDate)}</span></td>
                  <td>{fmtQty(l.batch.quantity, m.unitsPerPack, m.packName, m.unitName)}</td>
                  <td>
                    <Input type="number" min={1} max={l.batch.quantity} value={l.units} className="w-24"
                      onChange={(e) => {
                        const units = e.target.value;
                        setLines((ls) => ls.map((x, idx) => (idx === i ? { ...x, units, amount: String(round2(unitCost(x.batch) * (Number(units) || 0))) } : x)));
                      }}
                    />
                  </td>
                  <td><Input type="number" min={0} step="0.01" value={l.amount} className="w-28" onChange={(e) => setLines((ls) => ls.map((x, idx) => (idx === i ? { ...x, amount: e.target.value } : x)))} /></td>
                  <td><button onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="rounded p-1.5 text-slate-400 hover:text-red-600" aria-label="Remove"><Trash2 className="size-4" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4 border-t pt-4">
        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-medium">{error}</p>}
        <span className="text-sm">Total credit from supplier: <b>{money(total)}</b></span>
        <Button onClick={submit} disabled={pending || !lines.length} variant="danger">{pending ? "Saving…" : "Save return"}</Button>
      </div>
    </div>
  );
}
