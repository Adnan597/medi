import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { expiryWindow, lowStockMedicines } from "@/lib/queries";
import { daysUntil, fmtDateTime, fmtExpiry, fmtQty, money, num } from "@/lib/format";
import { Badge, Empty, Input, PageHeader, Table } from "@/components/ui";
import { Pager, pageOf } from "@/components/pager";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Stock & Expiry" };
const PAGE_SIZE = 20;

const VIEWS = [
  { key: "all", label: "All batches" },
  { key: "low", label: "Low stock" },
  { key: "near", label: "Near expiry" },
  { key: "expired", label: "Expired" },
  { key: "movements", label: "Stock history" },
] as const;

export default async function StockPage(props: PageProps<"/stock">) {
  await requireUser("stock");
  const sp = await props.searchParams;
  const view = (typeof sp.view === "string" ? sp.view : "all") as (typeof VIEWS)[number]["key"];
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = pageOf(sp);
  const settings = await getSettings();
  const { today, until } = await expiryWindow(settings.nearExpiryDays);

  // Valuation of sellable stock (cost and retail)
  const valuationRows = await db.batch.findMany({
    where: { quantity: { gt: 0 }, expiryDate: { gt: today } },
    select: { quantity: true, costPrice: true, salePrice: true, medicine: { select: { unitsPerPack: true } } },
  });
  const costValue = valuationRows.reduce((s, b) => s + (num(b.costPrice) / b.medicine.unitsPerPack) * b.quantity, 0);
  const saleValue = valuationRows.reduce((s, b) => s + (num(b.salePrice) / b.medicine.unitsPerPack) * b.quantity, 0);

  const tabs = (
    <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm">
      {VIEWS.map((v) => (
        <Link key={v.key} href={`/stock?view=${v.key}`} className={cn("rounded-lg px-3 py-1.5", view === v.key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          {v.label}
        </Link>
      ))}
    </div>
  );

  let body: React.ReactNode;

  if (view === "low") {
    const lowAll = await lowStockMedicines();
    const low = lowAll.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE + 1);
    body = (
      <>
        <Table>
          <thead><tr><th>Medicine</th><th>In stock</th><th>Reorder level</th><th></th></tr></thead>
          <tbody>
            {lowAll.length === 0 && <Empty colSpan={4}>No low-stock items 🎉</Empty>}
            {low.slice(0, PAGE_SIZE).map((m) => (
              <tr key={m.id}>
                <td><Link href={`/medicines/${m.id}`} className="text-brand-700 hover:underline">{m.name} {m.strength}</Link></td>
                <td className={m.stock === 0 ? "text-red-600" : "text-amber-600"}>{fmtQty(m.stock, m.unitsPerPack, m.packName, m.unitName)}</td>
                <td>{fmtQty(m.reorderLevel, m.unitsPerPack, m.packName, m.unitName)}</td>
                <td>{m.stock === 0 ? <Badge color="red">Out of stock</Badge> : <Badge color="amber">Reorder</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager page={page} hasMore={low.length > PAGE_SIZE} params={sp} />
      </>
    );
  } else if (view === "movements") {
    const moves = await db.stockMovement.findMany({
      where: q ? { medicine: { name: { contains: q, mode: "insensitive" } } } : {},
      include: { medicine: true, batch: { select: { batchNo: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    });
    body = (
      <>
        <form className="mb-3"><input type="hidden" name="view" value="movements" /><Input name="q" defaultValue={q} placeholder="Filter by medicine…" className="max-w-xs" /></form>
        <Table>
          <thead><tr><th>Date</th><th>Medicine</th><th>Batch</th><th>Type</th><th>Qty</th><th>By</th><th>Note</th></tr></thead>
          <tbody>
            {moves.length === 0 && <Empty colSpan={7}>No movements</Empty>}
            {moves.slice(0, PAGE_SIZE).map((m) => (
              <tr key={m.id}>
                <td className="text-slate-500">{fmtDateTime(m.createdAt)}</td>
                <td>{m.medicine.name} {m.medicine.strength}</td>
                <td className="font-mono text-xs">{m.batch.batchNo}</td>
                <td><Badge color={m.quantity > 0 ? "green" : "gray"}>{m.type.replace("_", " ")}</Badge></td>
                <td className={m.quantity > 0 ? "text-emerald-700" : "text-red-600"}>{m.quantity > 0 && "+"}{fmtQty(m.quantity, m.medicine.unitsPerPack, m.medicine.packName, m.medicine.unitName)}</td>
                <td>{m.user.name}</td>
                <td className="text-slate-500">{m.note}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager page={page} hasMore={moves.length > PAGE_SIZE} params={sp} />
      </>
    );
  } else {
    const where: Prisma.BatchWhereInput = {
      quantity: { gt: 0 },
      ...(view === "near" ? { expiryDate: { gt: today, lte: until } } : {}),
      ...(view === "expired" ? { expiryDate: { lte: today } } : {}),
      ...(q ? { OR: [{ batchNo: q }, { medicine: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    };
    const batches = await db.batch.findMany({
      where,
      include: { medicine: true },
      orderBy: view === "all" ? [{ medicine: { name: "asc" } }, { expiryDate: "asc" }] : { expiryDate: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    });
    const listValue = batches.slice(0, PAGE_SIZE).reduce((s, b) => s + (num(b.costPrice) / b.medicine.unitsPerPack) * b.quantity, 0);
    body = (
      <>
        <form className="mb-3 flex items-center gap-3">
          <input type="hidden" name="view" value={view} />
          <Input name="q" defaultValue={q} placeholder="Medicine or batch no…" className="max-w-xs" />
          <span className="text-sm text-slate-500">Showing page {page} · cost value {money(listValue)}</span>
          {view === "expired" && batches.length > 0 && (
            <Link href="/purchase-returns/new" className="text-sm text-brand-700 underline">Return expired to supplier →</Link>
          )}
        </form>
        <Table>
          <thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Qty</th><th className="text-right!">Cost / pack</th><th className="text-right!">Sale / pack</th><th className="text-right!">Cost value</th><th>Rack</th></tr></thead>
          <tbody>
            {batches.length === 0 && <Empty colSpan={8}>Nothing here</Empty>}
            {batches.slice(0, PAGE_SIZE).map((b) => {
              const d = daysUntil(b.expiryDate);
              return (
                <tr key={b.id}>
                  <td><Link href={`/medicines/${b.medicineId}`} className="text-brand-700 hover:underline">{b.medicine.name} {b.medicine.strength}</Link></td>
                  <td className="font-mono text-xs">{b.batchNo}</td>
                  <td>
                    {fmtExpiry(b.expiryDate)}{" "}
                    {d <= 0 ? <Badge color="red">Expired</Badge> : d <= settings.nearExpiryDays ? <Badge color="amber">{d}d</Badge> : null}
                  </td>
                  <td>{fmtQty(b.quantity, b.medicine.unitsPerPack, b.medicine.packName, b.medicine.unitName)}</td>
                  <td className="text-right tabular-nums">{money(b.costPrice)}</td>
                  <td className="text-right tabular-nums">{money(b.salePrice)}</td>
                  <td className="text-right tabular-nums">{money((num(b.costPrice) / b.medicine.unitsPerPack) * b.quantity)}</td>
                  <td className="text-slate-500">{b.medicine.rackLocation}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <Pager page={page} hasMore={batches.length > PAGE_SIZE} params={sp} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Stock & Expiry"
        subtitle={<>Sellable stock value: <b>{money(costValue)}</b> at cost · <b>{money(saleValue)}</b> at retail</>}
      />
      {tabs}
      {body}
    </>
  );
}
