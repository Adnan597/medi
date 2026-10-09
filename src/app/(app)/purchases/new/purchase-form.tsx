"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { savePurchase, searchCatalog, type CatalogItem } from "@/app/actions/purchases";
import { AsyncSearch } from "@/components/async-search";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { money, round2, todayPK } from "@/lib/format";

type Line = {
  key: number;
  med: CatalogItem;
  batchNo: string;
  expiryDate: string;
  packs: string;
  bonusPacks: string;
  costPrice: string;
  salePrice: string;
  discountPct: string;
};

let keySeq = 0;

export function PurchaseForm({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState(todayPK());
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [paid, setPaid] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const lineTotal = (l: Line) => round2((Number(l.packs) || 0) * (Number(l.costPrice) || 0) * (1 - (Number(l.discountPct) || 0) / 100));
  const subtotal = round2(lines.reduce((s, l) => s + lineTotal(l), 0));
  const total = round2(subtotal - (Number(discount) || 0) + (Number(tax) || 0));

  function add(med: CatalogItem) {
    setLines((ls) => [
      ...ls,
      {
        key: ++keySeq,
        med,
        batchNo: med.lastBatchNo ?? "",
        expiryDate: med.lastExpiryDate ? med.lastExpiryDate.slice(0, 10) : "",
        packs: med.lastPacks != null ? String(med.lastPacks) : "1",
        bonusPacks: "",
        costPrice: med.lastCost != null ? String(med.lastCost) : "",
        salePrice: med.salePrice ? String(med.salePrice) : "",
        discountPct: "",
      },
    ]);
  }
  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function submit() {
    setError(null);
    start(async () => {
      const res = await savePurchase({
        supplierId, invoiceNo: invoiceNo || null, date, discount: Number(discount) || 0, tax: Number(tax) || 0,
        paid: Number(paid) || 0, note: note || null,
        items: lines.map((l) => ({
          medicineId: l.med.id, batchNo: l.batchNo, expiryDate: l.expiryDate, packs: Number(l.packs) || 0,
          bonusPacks: Number(l.bonusPacks) || 0, costPrice: Number(l.costPrice) || 0, salePrice: Number(l.salePrice) || 0,
          discountPct: Number(l.discountPct) || 0,
        })),
      });
      if (!res.ok) setError(res.error);
      else router.push(`/purchases/${res.id}?saved=1`);
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <Field label="Supplier *">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Supplier bill no."><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></Field>
        <Field label="Bill date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <AsyncSearch<CatalogItem>
          search={searchCatalog}
          onPick={add}
          autoFocus
          placeholder="Search medicine to add to bill…"
          render={(m) => (
            <div className="flex justify-between gap-2">
              <span><b>{m.name}</b> {m.strength} <span className="text-slate-500">{m.genericName}</span></span>
              <span className="text-xs text-slate-500">{m.packName}{m.unitsPerPack > 1 && ` of ${m.unitsPerPack}`}{m.lastCost != null && ` · last cost ${money(m.lastCost)}`}</span>
            </div>
          )}
        />

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-2">Medicine</th><th className="pr-2">Batch no.</th><th className="pr-2">Expiry</th><th className="pr-2">Qty (packs)</th>
                <th className="pr-2">Bonus</th><th className="pr-2">Cost / pack</th><th className="pr-2">Disc %</th><th className="pr-2">Sale / pack</th><th className="pr-2 text-right">Amount</th><th></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-slate-400">No items yet — search above</td></tr>}
              {lines.map((l) => (
                <tr key={l.key} className="border-t border-slate-100">
                  <td className="py-2 pr-2">
                    <div className="font-medium">{l.med.name} {l.med.strength}</div>
                    <div className="text-xs text-slate-500">{l.med.packName}{l.med.unitsPerPack > 1 && ` of ${l.med.unitsPerPack} ${l.med.unitName}`}</div>
                  </td>
                  <td className="pr-2"><Input value={l.batchNo} onChange={(e) => set(l.key, { batchNo: e.target.value })} className="w-28" /></td>
                  <td className="pr-2"><Input type="date" value={l.expiryDate} onChange={(e) => set(l.key, { expiryDate: e.target.value })} className="w-36" /></td>
                  <td className="pr-2"><Input type="number" min={0} value={l.packs} onChange={(e) => set(l.key, { packs: e.target.value })} className="w-20" /></td>
                  <td className="pr-2"><Input type="number" min={0} value={l.bonusPacks} onChange={(e) => set(l.key, { bonusPacks: e.target.value })} className="w-16" /></td>
                  <td className="pr-2"><Input type="number" min={0} step="0.01" value={l.costPrice} onChange={(e) => set(l.key, { costPrice: e.target.value })} className="w-24" /></td>
                  <td className="pr-2"><Input type="number" min={0} max={100} step="0.01" value={l.discountPct} onChange={(e) => set(l.key, { discountPct: e.target.value })} className="w-16" /></td>
                  <td className="pr-2"><Input type="number" min={0} step="0.01" value={l.salePrice} onChange={(e) => set(l.key, { salePrice: e.target.value })} className="w-24" /></td>
                  <td className="pr-2 text-right font-medium tabular-nums">{money(lineTotal(l))}</td>
                  <td>
                    <button onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-500">Bill discount (Rs)</span><Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-32 text-right" /></div>
          <div className="flex items-center justify-between"><span className="text-slate-500">Tax / other charges (Rs)</span><Input type="number" min={0} value={tax} onChange={(e) => setTax(e.target.value)} className="w-32 text-right" /></div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-500">Paid now (Rs)</span><Input type="number" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} className="w-32 text-right" placeholder="0" /></div>
          <div className="flex justify-between text-amber-700"><span>Added to supplier balance</span><span className="tabular-nums">{money(Math.max(total - (Number(paid) || 0), 0))}</span></div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
          <Button onClick={submit} disabled={pending || !lines.length} className="w-full">{pending ? "Saving…" : "Save purchase"}</Button>
        </div>
      </div>
    </div>
  );
}
