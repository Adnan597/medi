import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { daysUntil, fmtDateTime, fmtExpiry, fmtQty, money, num } from "@/lib/format";
import { Badge, Button, Card, Empty, LinkButton, PageHeader, Table } from "@/components/ui";
import { MedicineForm } from "../medicine-form";
import { AdjustForm, OpeningStockForm } from "./batch-forms";
import { toggleMedicine } from "@/app/actions/medicines";

export const metadata = { title: "Medicine" };

export default async function MedicinePage(props: PageProps<"/medicines/[id]">) {
  const user = await requireUser("medicines");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const showCost = can(user.role, "viewCost");
  const settings = await getSettings();

  const med = await db.medicine.findUnique({
    where: { id },
    include: {
      category: true,
      manufacturer: true,
      batches: { orderBy: { expiryDate: "asc" } },
      movements: { orderBy: { createdAt: "desc" }, take: 25, include: { batch: { select: { batchNo: true } }, user: { select: { name: true } } } },
    },
  });
  if (!med) notFound();

  const [categories, manufacturers, substitutes] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.manufacturer.findMany({ orderBy: { name: "asc" } }),
    med.genericName
      ? db.medicine.findMany({
          where: { genericName: { equals: med.genericName, mode: "insensitive" }, id: { not: med.id }, active: true },
          select: { id: true, name: true, strength: true, salePrice: true, manufacturer: { select: { name: true } } },
          take: 10,
        })
      : [],
  ]);

  const q = (n: number) => fmtQty(n, med.unitsPerPack, med.packName, med.unitName);
  const sellable = med.batches.filter((b) => daysUntil(b.expiryDate) > 0).reduce((s, b) => s + b.quantity, 0);
  const expired = med.batches.filter((b) => daysUntil(b.expiryDate) <= 0).reduce((s, b) => s + b.quantity, 0);
  const medLite = { id: med.id, unitsPerPack: med.unitsPerPack, packName: med.packName, unitName: med.unitName, salePrice: num(med.salePrice) };

  return (
    <>
      {sp.saved && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">Medicine saved.</div>}
      <PageHeader
        title={`${med.name} ${med.strength ?? ""}`}
        subtitle={
          <>
            {med.genericName && <span>{med.genericName} · </span>}
            {med.form} · {med.manufacturer?.name ?? "—"} · {med.unitsPerPack > 1 ? `${med.packName} of ${med.unitsPerPack} ${med.unitName}` : med.packName}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <LinkButton href={`/medicines/${med.id}/edit`} variant="secondary">
              <Pencil className="size-4" /> Edit Medicine
            </LinkButton>
            <form action={toggleMedicine}>
              <input type="hidden" name="id" value={med.id} />
              <Button variant="secondary">{med.active ? "Deactivate" : "Activate"}</Button>
            </form>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4"><div className="text-xs uppercase text-slate-500">Sellable stock</div><div className="mt-1 text-lg font-semibold">{q(sellable)}</div></div>
        <div className="rounded-xl border bg-white p-4"><div className="text-xs uppercase text-slate-500">Expired stock</div><div className={`mt-1 text-lg font-semibold ${expired ? "text-red-600" : ""}`}>{q(expired)}</div></div>
        <div className="rounded-xl border bg-white p-4"><div className="text-xs uppercase text-slate-500">Price / {med.packName}</div><div className="mt-1 text-lg font-semibold">{money(med.salePrice)}</div></div>
        <div className="rounded-xl border bg-white p-4"><div className="text-xs uppercase text-slate-500">Reorder level</div><div className="mt-1 text-lg font-semibold">{q(med.reorderLevel)}</div></div>
      </div>

      <Card title="Batches" className="mb-5">
        <Table className="border-0 shadow-none">
          <thead>
            <tr><th>Batch</th><th>Expiry</th>{showCost && <th className="text-right!">Cost / pack</th>}<th className="text-right!">Sale / pack</th><th>Qty</th><th></th></tr>
          </thead>
          <tbody>
            {med.batches.length === 0 && <Empty colSpan={6}>No stock yet. Add via Purchase or Opening Stock below.</Empty>}
            {med.batches.map((b) => {
              const d = daysUntil(b.expiryDate);
              return (
                <tr key={b.id} className="align-top">
                  <td className="font-mono text-xs">{b.batchNo}</td>
                  <td>
                    {fmtExpiry(b.expiryDate)}{" "}
                    {d <= 0 ? <Badge color="red">Expired</Badge> : d <= settings.nearExpiryDays ? <Badge color="amber">{d}d left</Badge> : null}
                  </td>
                  {showCost && <td className="text-right tabular-nums">{money(b.costPrice)}</td>}
                  <td className="text-right tabular-nums">{money(b.salePrice)}</td>
                  <td>{q(b.quantity)}</td>
                  <td className="w-24">
                    <details>
                      <summary className="cursor-pointer text-sm text-brand-700">Manage</summary>
                      <div className="absolute right-6 z-10 mt-2 w-[min(640px,90vw)] rounded-xl border bg-white p-4 shadow-lg">
                        <AdjustForm med={medLite} batch={{ id: b.id, salePrice: num(b.salePrice), expiry: b.expiryDate.toISOString().slice(0, 10) }} />
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card title="Add opening stock" className="mb-5">
        <p className="mb-3 text-sm text-slate-500">Use this for stock already on your shelves. New stock from suppliers should be entered as a <Link href="/purchases/new" className="text-brand-700 underline">Purchase</Link>.</p>
        <OpeningStockForm med={medLite} />
      </Card>

      {substitutes.length > 0 && (
        <Card title={`Substitutes (same salt: ${med.genericName})`} className="mb-5">
          <ul className="flex flex-wrap gap-2 text-sm">
            {substitutes.map((s) => (
              <li key={s.id}>
                <Link href={`/medicines/${s.id}`} className="inline-block rounded-lg border px-3 py-1.5 hover:bg-slate-50">
                  {s.name} {s.strength} <span className="text-slate-500">· {s.manufacturer?.name} · {money(s.salePrice)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Stock history (last 25)">
        <Table className="border-0 shadow-none">
          <thead><tr><th>Date</th><th>Type</th><th>Batch</th><th>Qty</th><th>By</th><th>Note</th></tr></thead>
          <tbody>
            {med.movements.length === 0 && <Empty colSpan={6}>No movements</Empty>}
            {med.movements.map((m) => (
              <tr key={m.id}>
                <td className="text-slate-500">{fmtDateTime(m.createdAt)}</td>
                <td><Badge color={m.quantity > 0 ? "green" : "gray"}>{m.type.replace("_", " ")}</Badge></td>
                <td className="font-mono text-xs">{m.batch.batchNo}</td>
                <td className={m.quantity > 0 ? "text-emerald-700" : "text-red-600"}>{m.quantity > 0 ? "+" : ""}{q(m.quantity)}</td>
                <td>{m.user.name}</td>
                <td className="text-slate-500">{m.note}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
