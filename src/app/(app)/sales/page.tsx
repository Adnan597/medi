import Link from "next/link";
import { db } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { fmtDateTime, invoiceNo, money, num, pkRange, todayPK } from "@/lib/format";
import { Badge, Button, Empty, Field, Input, PageHeader, Select, Table } from "@/components/ui";
import { Pager, pageOf } from "@/components/pager";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Sales" };
const PAGE_SIZE = 20;

export default async function SalesPage(props: PageProps<"/sales">) {
  const user = await requireUser("sales");
  const sp = await props.searchParams;
  const from = typeof sp.from === "string" && sp.from ? sp.from : todayPK();
  const to = typeof sp.to === "string" && sp.to ? sp.to : from;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const method = typeof sp.method === "string" ? sp.method : "";
  const page = pageOf(sp);
  const showProfit = can(user.role, "viewCost");

  const num6 = Number(q.replace(/\D/g, ""));
  const where: Prisma.SaleWhereInput = {
    ...(q
      ? { OR: [...(num6 ? [{ number: num6 }] : []), { customer: { name: { contains: q, mode: "insensitive" } } }, { patientName: { contains: q, mode: "insensitive" } }] }
      : { date: pkRange(from, to), ...(method ? { paymentMethod: method as Prisma.SaleWhereInput["paymentMethod"] } : {}) }),
    // Cashiers only see their own sales — in search results too
    ...(user.role === "CASHIER" ? { userId: user.id } : {}),
  };

  const [sales, agg, returns] = await Promise.all([
    db.sale.findMany({
      where,
      include: { customer: { select: { name: true } }, user: { select: { name: true } }, _count: { select: { items: true, returns: true } } },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    }),
    db.sale.aggregate({ where, _sum: { total: true, costTotal: true, paid: true }, _count: true }),
    db.saleReturn.aggregate({ where: { sale: where }, _sum: { total: true } }),
  ]);

  return (
    <>
      <PageHeader title="Sales" subtitle="Invoices, reprints and returns" />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="From"><Input type="date" name="from" defaultValue={from} /></Field>
        <Field label="To"><Input type="date" name="to" defaultValue={to} /></Field>
        <Field label="Payment">
          <Select name="method" defaultValue={method} className="w-32">
            <option value="">All</option><option>CASH</option><option>CARD</option><option>ONLINE</option><option>CREDIT</option>
          </Select>
        </Field>
        <Field label="Invoice # / customer"><Input name="q" defaultValue={q} placeholder="e.g. 123 or Ahmed" /></Field>
        <Button variant="secondary" type="submit">Filter</Button>
      </form>

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span>Invoices: <b>{agg._count}</b></span>
        <span>Sales: <b>{money(agg._sum.total)}</b></span>
        <span>Returns: <b className="text-red-600">{money(returns._sum.total)}</b></span>
        <span>Net: <b>{money(num(agg._sum.total) - num(returns._sum.total))}</b></span>
        {showProfit && <span>Gross profit: <b className="text-emerald-700">{money(num(agg._sum.total) - num(agg._sum.costTotal))}</b></span>}
      </div>

      <Table>
        <thead>
          <tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Cashier</th><th className="text-right!">Total</th><th></th></tr>
        </thead>
        <tbody>
          {sales.length === 0 && <Empty colSpan={8}>No sales in this period</Empty>}
          {sales.slice(0, PAGE_SIZE).map((s) => (
            <tr key={s.id}>
              <td><Link href={`/sales/${s.id}`} className="font-medium text-brand-700 hover:underline">{invoiceNo(s.number)}</Link></td>
              <td className="text-slate-500">{fmtDateTime(s.date)}</td>
              <td>{s.customer?.name ?? s.patientName ?? "Walk-in"}</td>
              <td>{s._count.items}</td>
              <td>
                <Badge color={s.paymentMethod === "CREDIT" ? "amber" : "gray"}>{s.paymentMethod}</Badge>
                {s._count.returns > 0 && <span className="ml-1"><Badge color="red">Returned</Badge></span>}
              </td>
              <td className="text-slate-500">{s.user.name}</td>
              <td className="text-right tabular-nums">{money(s.total)}</td>
              <td className="text-right space-x-2">
                <Link href={`/sales/${s.id}`} className="text-xs font-semibold text-amber-700 hover:underline">Return / View</Link>
                <a href={`/receipt/${s.id}`} target="_blank" className="text-xs text-slate-500 hover:text-brand-700">Print</a>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager page={page} hasMore={sales.length > PAGE_SIZE} params={sp} />
    </>
  );
}
