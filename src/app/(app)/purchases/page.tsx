import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addDays, fmtDate, invoiceNo, money, num, pkRange, todayPK } from "@/lib/format";
import { Button, Empty, Field, Input, LinkButton, PageHeader, Select, Table } from "@/components/ui";
import { Pager, pageOf } from "@/components/pager";

export const metadata = { title: "Purchases" };
const PAGE_SIZE = 20;

export default async function PurchasesPage(props: PageProps<"/purchases">) {
  await requireUser("purchases");
  const sp = await props.searchParams;
  const from = typeof sp.from === "string" && sp.from ? sp.from : addDays(todayPK(), -30);
  const to = typeof sp.to === "string" && sp.to ? sp.to : todayPK();
  const supplierId = typeof sp.supplier === "string" ? sp.supplier : "";
  const page = pageOf(sp);
  const where = { date: pkRange(from, to), ...(supplierId ? { supplierId } : {}) };

  const [purchases, agg, suppliers] = await Promise.all([
    db.purchase.findMany({
      where,
      include: { supplier: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    }),
    db.purchase.aggregate({ where, _sum: { total: true, paid: true }, _count: true }),
    db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title="Purchases" subtitle="Stock received from suppliers" actions={<LinkButton href="/purchases/new"><Plus className="size-4" /> New Purchase</LinkButton>} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="From"><Input type="date" name="from" defaultValue={from} /></Field>
        <Field label="To"><Input type="date" name="to" defaultValue={to} /></Field>
        <Field label="Supplier">
          <Select name="supplier" defaultValue={supplierId} className="w-48">
            <option value="">All suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Button variant="secondary" type="submit">Filter</Button>
      </form>
      <div className="mb-4 flex flex-wrap gap-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span>Bills: <b>{agg._count}</b></span>
        <span>Total: <b>{money(agg._sum.total)}</b></span>
        <span>Paid at purchase: <b>{money(agg._sum.paid)}</b></span>
        <span>On credit: <b className="text-amber-700">{money(num(agg._sum.total) - num(agg._sum.paid))}</b></span>
      </div>
      <Table>
        <thead><tr><th>#</th><th>Date</th><th>Supplier</th><th>Bill no.</th><th>Items</th><th className="text-right!">Total</th><th className="text-right!">Paid</th></tr></thead>
        <tbody>
          {purchases.length === 0 && <Empty colSpan={7}>No purchases in this period</Empty>}
          {purchases.slice(0, PAGE_SIZE).map((p) => (
            <tr key={p.id}>
              <td><Link href={`/purchases/${p.id}`} className="font-medium text-brand-700 hover:underline">{invoiceNo(p.number, "PUR")}</Link></td>
              <td>{fmtDate(p.date)}</td>
              <td>{p.supplier.name}</td>
              <td className="text-slate-500">{p.invoiceNo}</td>
              <td>{p._count.items}</td>
              <td className="text-right tabular-nums">{money(p.total)}</td>
              <td className="text-right tabular-nums">{money(p.paid)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager page={page} hasMore={purchases.length > PAGE_SIZE} params={sp} />
    </>
  );
}
