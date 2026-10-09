import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtQty, money, num, pkRange, todayPK, toPKDateString } from "@/lib/format";
import { Button, Card, Empty, Field, Input, PageHeader, Stat, Table } from "@/components/ui";

export const metadata = { title: "Reports" };

export default async function ReportsPage(props: PageProps<"/reports">) {
  await requireUser("reports");
  const sp = await props.searchParams;
  const today = todayPK();
  const from = typeof sp.from === "string" && sp.from ? sp.from : `${today.slice(0, 8)}01`;
  const to = typeof sp.to === "string" && sp.to ? sp.to : today;
  const range = pkRange(from, to);

  const [sales, byMethod, returns, returnItems, expenses, purchases, topItems, dailySales] = await Promise.all([
    db.sale.aggregate({ where: { date: range }, _sum: { total: true, costTotal: true, discount: true }, _count: true }),
    db.sale.groupBy({ by: ["paymentMethod"], where: { date: range }, _sum: { total: true, paid: true }, _count: true }),
    db.saleReturn.aggregate({ where: { createdAt: range }, _sum: { total: true } }),
    db.saleReturnItem.findMany({
      where: { return: { createdAt: range } },
      select: { quantity: true, amount: true, return: { select: { createdAt: true } }, saleItem: { select: { unitCost: true } } },
    }),
    db.expense.aggregate({ where: { date: range }, _sum: { amount: true } }),
    db.purchase.aggregate({ where: { date: range }, _sum: { total: true }, _count: true }),
    db.saleItem.findMany({
      where: { sale: { date: range } },
      select: { medicineId: true, quantity: true, returnedQty: true, lineTotal: true },
    }),
    db.sale.findMany({ where: { date: range }, select: { date: true, total: true, costTotal: true } }),
  ]);

  // Top sellers, net of returns
  const byMed = new Map<string, { qty: number; revenue: number }>();
  for (const it of topItems) {
    const kept = it.quantity - it.returnedQty;
    const cur = byMed.get(it.medicineId) ?? { qty: 0, revenue: 0 };
    cur.qty += kept;
    cur.revenue += it.quantity ? (num(it.lineTotal) * kept) / it.quantity : 0;
    byMed.set(it.medicineId, cur);
  }
  const top = [...byMed.entries()]
    .filter(([, v]) => v.qty > 0)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 20);
  const meds = await db.medicine.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, name: true, strength: true, unitsPerPack: true, unitName: true, packName: true },
  });
  const medMap = new Map(meds.map((m) => [m.id, m]));

  // Cost of goods for items returned, so profit isn't overstated.
  const returnedCost = returnItems.reduce((s, r) => s + num(r.saleItem.unitCost) * r.quantity, 0);
  const grossSales = num(sales._sum.total);
  const returnTotal = num(returns._sum.total);
  const netSales = grossSales - returnTotal;
  const cogs = num(sales._sum.costTotal) - returnedCost;
  const grossProfit = netSales - cogs;
  const expenseTotal = num(expenses._sum.amount);
  const netProfit = grossProfit - expenseTotal;
  const margin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // Daily figures, with returns counted on the day they happened
  const days = new Map<string, { total: number; cost: number; count: number }>();
  const day = (d: string) => days.get(d) ?? { total: 0, cost: 0, count: 0 };
  for (const s of dailySales) {
    const d = toPKDateString(s.date);
    const cur = day(d);
    cur.total += num(s.total);
    cur.cost += num(s.costTotal);
    cur.count += 1;
    days.set(d, cur);
  }
  for (const r of returnItems) {
    const d = toPKDateString(r.return.createdAt);
    const cur = day(d);
    cur.total -= num(r.amount);
    cur.cost -= num(r.saleItem.unitCost) * r.quantity;
    days.set(d, cur);
  }
  const dayRows = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <PageHeader title="Reports" subtitle={`${fmtDate(range.gte)} – ${fmtDate(range.lte)}`} />
      <form className="mb-5 flex flex-wrap items-end gap-2">
        <Field label="From"><Input type="date" name="from" defaultValue={from} /></Field>
        <Field label="To"><Input type="date" name="to" defaultValue={to} /></Field>
        <Button variant="secondary" type="submit">Show</Button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Net sales" value={money(netSales)} hint={`${sales._count} invoices · returns ${money(returnTotal)}`} />
        <Stat label="Cost of goods sold" value={money(cogs)} />
        <Stat label="Gross profit" value={money(grossProfit)} tone="good" hint={`Margin ${margin.toFixed(1)}%`} />
        <Stat label="Net profit" value={money(netProfit)} tone={netProfit >= 0 ? "good" : "bad"} hint={`After expenses ${money(expenseTotal)}`} />
        <Stat label="Discounts given" value={money(sales._sum.discount)} />
        <Stat label="Purchases" value={money(purchases._sum.total)} hint={`${purchases._count} bill${purchases._count === 1 ? "" : "s"}`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="By payment method">
          <Table className="border-0 shadow-none">
            <thead><tr><th>Method</th><th>Invoices</th><th className="text-right!">Sales</th><th className="text-right!">Collected</th></tr></thead>
            <tbody>
              {byMethod.length === 0 && <Empty colSpan={4}>No sales</Empty>}
              {byMethod.map((m) => (
                <tr key={m.paymentMethod}>
                  <td>{m.paymentMethod}</td><td>{m._count}</td>
                  <td className="text-right tabular-nums">{money(m._sum.total)}</td>
                  <td className="text-right tabular-nums">{money(Math.min(num(m._sum.paid), num(m._sum.total)))}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title="Daily sales">
          <Table className="border-0 shadow-none">
            <thead><tr><th>Date</th><th>Invoices</th><th className="text-right!">Net sales</th><th className="text-right!">Gross profit</th></tr></thead>
            <tbody>
              {dayRows.length === 0 && <Empty colSpan={4}>No sales</Empty>}
              {dayRows.map(([d, v]) => (
                <tr key={d}>
                  <td>{fmtDate(`${d}T12:00:00+05:00`)}</td><td>{v.count}</td>
                  <td className="text-right tabular-nums">{money(v.total)}</td>
                  <td className="text-right tabular-nums text-emerald-700">{money(v.total - v.cost)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title="Top 20 selling medicines" className="lg:col-span-2">
          <Table className="border-0 shadow-none">
            <thead><tr><th>#</th><th>Medicine</th><th>Qty sold</th><th className="text-right!">Revenue</th></tr></thead>
            <tbody>
              {top.length === 0 && <Empty colSpan={4}>No sales</Empty>}
              {top.map(([id, t], i) => {
                const m = medMap.get(id);
                return (
                  <tr key={id}>
                    <td className="text-slate-400">{i + 1}</td>
                    <td>{m?.name} {m?.strength}</td>
                    <td>{m ? fmtQty(t.qty, m.unitsPerPack, m.packName, m.unitName) : t.qty}</td>
                    <td className="text-right tabular-nums">{money(t.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
