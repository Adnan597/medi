"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Search, Trash2, Printer, UserPlus, AlertTriangle } from "lucide-react";
import { completeSale, quickAddCustomer, searchMedicines, type PosMedicine } from "@/app/actions/pos";
import { allocateFEFO } from "@/lib/fefo";
import { fmtExpiry, fmtQty, invoiceNo, money, round2 } from "@/lib/format";
import { Badge, Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

type Customer = { id: string; name: string; phone: string | null; balance: number };
type CartLine = { med: PosMedicine; packs: number; units: number; discount: number; discountType: "FIXED" | "PERCENT" };
type Method = "CASH" | "CARD" | "ONLINE" | "CREDIT";

function lineUnits(l: CartLine) {
  return l.packs * l.med.unitsPerPack + l.units;
}

/** Mirrors the server's pricing: FEFO batches, per-batch price, rounded per allocation. */
function priceLine(l: CartLine) {
  const qty = lineUnits(l);
  const { allocations, shortBy } = allocateFEFO(l.med.batches, qty);
  const gross = allocations.reduce((s, a) => s + round2((a.batch.salePrice / l.med.unitsPerPack) * a.quantity), 0);
  let discountRs = 0;
  if (l.discountType === "PERCENT") {
    const pct = Math.min(100, Math.max(0, l.discount || 0));
    discountRs = round2((gross * pct) / 100);
  } else {
    discountRs = Math.min(gross, Math.max(0, l.discount || 0));
  }
  const total = round2(Math.max(0, gross - discountRs));
  return { qty, gross: round2(gross), discountRs, total, shortBy, allocations };
}

export function PosClient({ customers: initialCustomers, walkInLabel }: { customers: Customer[]; walkInLabel: string }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; items: PosMedicine[] }>({ q: "", items: [] });
  const [hi, setHi] = useState(0);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState("");
  const [method, setMethod] = useState<Method>("CASH");
  const [billDiscount, setBillDiscount] = useState("");
  const [billDiscountType, setBillDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [paid, setPaid] = useState("");
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{ id: string; number: number; change: number } | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [pending, startTransition] = useTransition();
  // Only show results that belong to the current query
  const results = found.q === query.trim() ? found.items : [];
  const searchRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);
  const printFrame = useRef<HTMLIFrameElement>(null);
  const printSeq = useRef(0);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (!q) return; // dropdown is hidden when the box is empty
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await searchMedicines(q);
      if (id === reqId.current) {
        setFound({ q, items: r });
        setHi(0);
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Keyboard shortcuts: F2 = search, F9 = complete sale
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F9") {
        e.preventDefault();
        document.getElementById("complete-sale")?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const priced = useMemo(() => cart.map((l) => ({ line: l, ...priceLine(l) })), [cart]);
  const subtotal = round2(priced.reduce((s, p) => s + p.total, 0));
  const rawBillDiscount = Math.max(0, Number(billDiscount) || 0);
  const billDiscountRs = billDiscountType === "PERCENT"
    ? round2((subtotal * Math.min(100, rawBillDiscount)) / 100)
    : rawBillDiscount;
  const discountNum = Math.min(billDiscountRs, subtotal);
  const total = round2(subtotal - discountNum);
  const paidNum = paid === "" ? (method === "CREDIT" ? 0 : total) : Number(paid) || 0;
  const change = method === "CASH" ? round2(Math.max(paidNum - total, 0)) : 0;
  const due = round2(Math.max(total - paidNum, 0));
  const hasShort = priced.some((p) => p.shortBy > 0);
  const needsRx = cart.some((l) => l.med.requiresPrescription || l.med.isControlled);
  const customer = customers.find((c) => c.id === customerId);

  function addToCart(med: PosMedicine) {
    setError(null);
    setLastSale(null);
    if (med.stock <= 0) {
      setError(`${med.name} is out of stock`);
      return;
    }
    setCart((c) => {
      const i = c.findIndex((l) => l.med.id === med.id);
      if (i >= 0) {
        const copy = [...c];
        const existingUnits = lineUnits(copy[i]);
        const addUnits = copy[i].med.unitsPerPack;
        if (existingUnits + addUnits > med.stock) {
          const maxAddableUnits = med.stock - existingUnits;
          if (maxAddableUnits <= 0) {
            setError(`Stock limit reached! Only ${fmtQty(med.stock, med.unitsPerPack, med.packName, med.unitName)} available for ${med.name}`);
            return c;
          }
          if (copy[i].med.allowLooseSale) {
            const newTotalUnits = med.stock;
            const newPacks = Math.floor(newTotalUnits / med.unitsPerPack);
            const newUnits = newTotalUnits % med.unitsPerPack;
            copy[i] = { ...copy[i], packs: newPacks, units: newUnits };
            setError(`Added max available stock (${fmtQty(med.stock, med.unitsPerPack, med.packName, med.unitName)}) for ${med.name}`);
            return copy;
          } else {
            setError(`Stock limit reached! Only ${fmtQty(med.stock, med.unitsPerPack, med.packName, med.unitName)} available for ${med.name}`);
            return c;
          }
        }
        copy[i] = { ...copy[i], packs: copy[i].packs + 1 };
        return copy;
      }

      if (med.stock < med.unitsPerPack) {
        if (med.allowLooseSale) {
          setError(`Added max available stock (${fmtQty(med.stock, med.unitsPerPack, med.packName, med.unitName)}) for ${med.name}`);
          return [...c, { med, packs: 0, units: med.stock, discount: 0, discountType: "FIXED" }];
        } else {
          setError(`Cannot add ${med.name}: Available stock (${fmtQty(med.stock, med.unitsPerPack, med.packName, med.unitName)}) is less than 1 full ${med.packName}`);
          return c;
        }
      }

      return [...c, { med, packs: 1, units: 0, discount: 0, discountType: "FIXED" }];
    });
    setQuery("");
    searchRef.current?.focus();
  }

  function handlePacksChange(i: number, rawVal: number) {
    setError(null);
    const l = cart[i];
    const requestedPacks = Math.max(0, Math.floor(rawVal));
    const requestedUnitsTotal = requestedPacks * l.med.unitsPerPack + l.units;

    if (requestedUnitsTotal > l.med.stock) {
      const maxPacksForCurrentUnits = Math.floor((l.med.stock - l.units) / l.med.unitsPerPack);
      const clampedPacks = Math.max(0, maxPacksForCurrentUnits);
      const finalUnits = Math.min(l.units, Math.max(0, l.med.stock - clampedPacks * l.med.unitsPerPack));
      
      update(i, { packs: clampedPacks, units: finalUnits });
      setError(`Stock limit reached! Only ${fmtQty(l.med.stock, l.med.unitsPerPack, l.med.packName, l.med.unitName)} available in stock for ${l.med.name}`);
    } else {
      update(i, { packs: requestedPacks });
    }
  }

  function handleUnitsChange(i: number, rawVal: number) {
    setError(null);
    const l = cart[i];
    const requestedUnits = Math.max(0, Math.floor(rawVal));
    const maxAllowedLoose = l.med.unitsPerPack - 1;
    const cappedLoose = Math.min(requestedUnits, maxAllowedLoose);
    const requestedUnitsTotal = l.packs * l.med.unitsPerPack + cappedLoose;

    if (requestedUnitsTotal > l.med.stock) {
      const maxUnitsForCurrentPacks = Math.max(0, l.med.stock - l.packs * l.med.unitsPerPack);
      const clampedUnits = Math.min(cappedLoose, maxUnitsForCurrentPacks);
      
      update(i, { units: clampedUnits });
      setError(`Stock limit reached! Only ${fmtQty(l.med.stock, l.med.unitsPerPack, l.med.packName, l.med.unitName)} available in stock for ${l.med.name}`);
    } else {
      update(i, { units: cappedLoose });
    }
  }

  async function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Escape") {
      setQuery("");
    } else if (e.key === "Enter") {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      // Barcode scanners type fast and press Enter — search right away.
      let list = results;
      if (found.q !== q || searching) {
        reqId.current++;
        list = await searchMedicines(q);
        setFound({ q, items: list });
      }
      const exact = list.find((m) => m.barcode === q);
      const pick = exact ?? list[hi] ?? (list.length === 1 ? list[0] : undefined);
      if (pick) addToCart(pick);
    }
  }

  function update(i: number, patch: Partial<CartLine>) {
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function reset() {
    setCart([]);
    setBillDiscount("");
    setBillDiscountType("FIXED");
    setPaid("");
    setPatientName("");
    setDoctorName("");
    setCustomerId("");
    setMethod("CASH");
  }

  function printReceipt(id: string) {
    const f = printFrame.current;
    if (!f) return;
    f.onload = () => f.contentWindow?.print();
    f.src = `/receipt/${id}?print=${++printSeq.current}`;
  }

  function submit() {
    setError(null);
    if (!cart.length) return setError("Cart is empty");
    for (const p of priced) {
      if (p.qty <= 0) return setError(`Enter quantity for ${p.line.med.name}`);
      if (!p.line.med.allowLooseSale && p.line.units > 0) return setError(`${p.line.med.name} can't be sold loose`);
    }
    if (hasShort) return setError("Some items don't have enough stock");
    if (cart.some((l) => l.med.isControlled) && (!patientName.trim() || !doctorName.trim())) {
      return setError("Controlled drug in cart — enter patient and doctor name");
    }
    if (due > 0 && !customerId) return setError("Select a customer for credit / partial payment");

    startTransition(async () => {
      const res = await completeSale({
        customerId: customerId || null,
        paymentMethod: method,
        discount: discountNum,
        paid: paidNum,
        patientName: patientName || null,
        doctorName: doctorName || null,
        items: cart.map((l) => ({ medicineId: l.med.id, quantity: lineUnits(l), discount: priceLine(l).discountRs })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLastSale({ id: res.saleId, number: res.number, change });
      if (due > 0 && customer) {
        setCustomers((cs) => cs.map((c) => (c.id === customer.id ? { ...c, balance: c.balance + due } : c)));
      }
      reset();
      if (autoPrint) printReceipt(res.saleId);
      searchRef.current?.focus();
    });
  }

  async function addCustomer(fd: FormData) {
    const r = await quickAddCustomer(String(fd.get("name") ?? ""), String(fd.get("phone") ?? ""));
    if (!r.ok) return setError(r.error);
    setCustomers((cs) => [...cs, r.customer].sort((a, b) => a.name.localeCompare(b.name)));
    setCustomerId(r.customer.id);
    setShowNewCustomer(false);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <iframe ref={printFrame} className="hidden" title="receipt" />

      {/* Left: search + cart */}
      <div className="min-w-0 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            ref={searchRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Search medicine by name / salt, or scan barcode  (F2)"
            className="h-12 pl-9 text-base"
          />
          {query.trim() && (
            <div className="absolute z-20 mt-1 max-h-[420px] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
              {found.q !== query.trim() && <p className="p-4 text-sm text-slate-400">Searching…</p>}
              {found.q === query.trim() && results.length === 0 && <p className="p-4 text-sm text-slate-400">No medicine found</p>}
              {results.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseEnter={() => setHi(i)}
                  onClick={() => addToCart(m)}
                  className={cn("flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left last:border-0", i === hi && "bg-brand-50")}
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {m.name} <span className="font-normal text-slate-500">{m.strength} · {m.form}</span>
                      {m.requiresPrescription && <span className="ml-1"><Badge color="blue">Rx</Badge></span>}
                      {m.isControlled && <span className="ml-1"><Badge color="red">Controlled</Badge></span>}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {m.genericName}{m.rackLocation && ` · Rack ${m.rackLocation}`}
                      {m.batches[0] && ` · Exp ${fmtExpiry(m.batches[0].expiryDate)}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <div className="font-medium tabular-nums">
                      {m.batches[0] ? money(m.batches[0].salePrice) : "—"}
                      <span className="text-xs text-slate-500">/{m.packName}</span>
                    </div>
                    {m.batches[0] && m.unitsPerPack > 1 && (
                      <div className="text-xs text-slate-500 tabular-nums">
                        {money(m.batches[0].salePrice / m.unitsPerPack)}/{m.unitName}
                      </div>
                    )}
                    <div className={cn("text-xs font-medium mt-0.5", m.stock === 0 ? "text-red-600 font-bold" : "text-emerald-700")}>
                      Stock: {m.stock === 0 ? "Out of stock" : fmtQty(m.stock, m.unitsPerPack, m.packName, m.unitName)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700">{error}</div>}
        {lastSale && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            <span>
              Sale <b>{invoiceNo(lastSale.number)}</b> saved.{lastSale.change > 0 && <> Return change: <b>{money(lastSale.change)}</b></>}
            </span>
            <Button variant="secondary" onClick={() => printReceipt(lastSale.id)}><Printer className="size-4" /> Print receipt</Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Item</th>
                <th className="px-3 py-2.5">Qty</th>
                <th className="px-3 py-2.5 text-right">Rate</th>
                <th className="px-3 py-2.5">Disc</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 && (
                <tr><td colSpan={6} className="py-14 text-center text-slate-400">Search or scan a medicine to start the bill</td></tr>
              )}
              {priced.map(({ line: l, qty, total: lt, shortBy, allocations }, i) => (
                <tr key={l.med.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{l.med.name} <span className="font-normal text-slate-500">{l.med.strength}</span></div>
                    <div className="text-xs text-slate-500">
                      {allocations.map((a) => `${a.batch.batchNo} (exp ${fmtExpiry(a.batch.expiryDate)})`).join(", ")}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      Stock: <span className="font-semibold text-emerald-700">{fmtQty(l.med.stock, l.med.unitsPerPack, l.med.packName, l.med.unitName)}</span>
                    </div>
                    {shortBy > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600">
                        <AlertTriangle className="size-3.5" /> Stock exceeded! Max: {fmtQty(l.med.stock, l.med.unitsPerPack, l.med.packName, l.med.unitName)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Input type="number" min={0} value={l.packs} onChange={(e) => handlePacksChange(i, Number(e.target.value) || 0)} className="w-16 shrink-0 px-2 text-center" aria-label="Packs" />
                      <span className="text-xs text-slate-500">{l.med.packName}</span>
                      {l.med.unitsPerPack > 1 && l.med.allowLooseSale && (
                        <>
                          <Input type="number" min={0} max={l.med.unitsPerPack - 1} value={l.units} onChange={(e) => handleUnitsChange(i, Number(e.target.value) || 0)} className="w-16 shrink-0 px-2 text-center" aria-label="Loose units" />
                          <span className="text-xs text-slate-500">{l.med.unitName}</span>
                        </>
                      )}
                    </div>
                    {l.med.unitsPerPack > 1 && <div className="mt-0.5 text-xs text-slate-400">= {qty} {l.med.unitName}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {l.med.batches[0] ? (
                      <div>
                        <div>
                          {money(l.med.batches[0].salePrice)}
                          <span className="text-xs text-slate-500">/{l.med.packName}</span>
                        </div>
                        {l.med.unitsPerPack > 1 && (
                          <div className="text-xs text-slate-500">
                            {money(l.med.batches[0].salePrice / l.med.unitsPerPack)}
                            <span>/{l.med.unitName}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={l.discountType === "PERCENT" ? 100 : undefined}
                        value={l.discount || ""}
                        onChange={(e) => update(i, { discount: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-16 shrink-0 px-1.5 text-right text-xs"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        onClick={() => update(i, { discountType: l.discountType === "PERCENT" ? "FIXED" : "PERCENT" })}
                        className={cn(
                          "flex h-8 w-7 shrink-0 items-center justify-center rounded border text-xs font-semibold transition-colors",
                          l.discountType === "PERCENT" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        )}
                        title="Click to toggle Rs / %"
                      >
                        {l.discountType === "PERCENT" ? "%" : "Rs"}
                      </button>
                    </div>
                    {l.discountType === "PERCENT" && l.discount > 0 && (
                      <div className="mt-0.5 text-[10px] font-medium text-slate-500 text-right tabular-nums">
                        = -{money(priceLine(l).discountRs)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{money(lt)}</td>
                  <td className="px-2 py-2">
                    <button onClick={() => setCart((c) => c.filter((_, idx) => idx !== i))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: payment */}
      <aside className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Customer</span>
            <button type="button" onClick={() => setShowNewCustomer((s) => !s)} className="flex items-center gap-1 text-xs text-brand-700 hover:underline">
              <UserPlus className="size-3.5" /> New
            </button>
          </div>
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">{walkInLabel}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
            ))}
          </Select>
          {customer && customer.balance > 0 && <p className="mt-1 text-xs text-amber-700">Previous due: {money(customer.balance)}</p>}
          {showNewCustomer && (
            <form action={addCustomer} className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
              <Input name="name" placeholder="Customer name" required />
              <Input name="phone" placeholder="Phone" />
              <Button type="submit" variant="secondary" className="w-full">Add customer</Button>
            </form>
          )}
          {needsRx && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Patient name" />
              <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Doctor name" />
              <p className="col-span-2 text-xs text-sky-700">Cart has prescription / controlled items.</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Items</dt><dd>{cart.length}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{money(subtotal)}</dd></div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Bill discount</dt>
                <dd className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={billDiscountType === "PERCENT" ? 100 : undefined}
                    value={billDiscount}
                    onChange={(e) => setBillDiscount(e.target.value)}
                    placeholder="0"
                    className="w-24 text-right"
                  />
                  <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => setBillDiscountType("FIXED")}
                      className={cn("px-2 py-0.5 text-xs font-semibold rounded-md transition-colors", billDiscountType === "FIXED" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                    >
                      Rs
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillDiscountType("PERCENT")}
                      className={cn("px-2 py-0.5 text-xs font-semibold rounded-md transition-colors", billDiscountType === "PERCENT" ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
                    >
                      %
                    </button>
                  </div>
                </dd>
              </div>
              {discountNum > 0 && (
                <div className="text-right text-xs font-medium text-emerald-700 tabular-nums">
                  - {money(discountNum)} {billDiscountType === "PERCENT" && `(${rawBillDiscount}%)`}
                </div>
              )}
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(total)}</dd></div>
          </dl>

          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {(["CASH", "CARD", "ONLINE", "CREDIT"] as Method[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn("rounded-lg border px-2 py-2 text-xs font-medium", method === m ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
              >
                {m === "CREDIT" ? "Udhaar" : m[0] + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-600">{method === "CASH" ? "Cash received" : "Amount paid"}</span>
            <Input type="number" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={method === "CREDIT" ? "0" : String(total)} className="mt-1 h-11 text-right text-base" />
          </label>
          <div className="mt-2 space-y-1 text-sm">
            {change > 0 && <div className="flex justify-between font-medium text-emerald-700"><span>Change to return</span><span className="tabular-nums">{money(change)}</span></div>}
            {due > 0 && <div className="flex justify-between font-medium text-amber-700"><span>Added to udhaar</span><span className="tabular-nums">{money(due)}</span></div>}
          </div>

          <Button id="complete-sale" onClick={submit} disabled={pending || !cart.length} className="mt-4 h-12 w-full text-base">
            {pending ? "Saving…" : `Complete sale  (F9)`}
          </Button>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} className="accent-brand-600" /> Print receipt automatically</label>
            {cart.length > 0 && <button type="button" onClick={reset} className="text-red-600 hover:underline">Clear bill</button>}
          </div>
        </div>
      </aside>
    </div>
  );
}
