import Link from "next/link";
import { ShoppingCart, PackagePlus, Pill } from "lucide-react";
import { db } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { expiryWindow, lowStockMedicines, salesSummary } from "@/lib/queries";
import { fmtDateTime, fmtExpiry, invoiceNo, money, num, pkRange, todayPK, addDays, daysUntil, fmtQty } from "@/lib/format";
import { Badge, Card, LinkButton, PageHeader, Stat, Table, Empty } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function Dashboard(props: PageProps<"/">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const settings = await getSettings();
  const showMoney = can(user.role, "viewCost");
  const today = todayPK();
  const monthStart = `${today.slice(0, 8)}01`;
  const { today: todayDate, until } = await expiryWindow(settings.nearExpiryDays);

  const [todayS, monthS, recent, nearExpiry, expiredCount, receivable, payable, low, week] = await Promise.all([
    salesSummary(pkRange(today)),
    salesSummary(pkRange(monthStart, today)),
    db.sale.findMany({ orderBy: { date: "desc" }, take: 8, include: { customer: { select: { name: true } } } }),
    db.batch.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { gt: todayDate, lte: until } },
      include: { medicine: { select: { name: true, strength: true, unitsPerPack: true, packName: true, unitName: true } } },
      orderBy: { expiryDate: "asc" },
      take: 8,
    }),
    db.batch.count({ where: { quantity: { gt: 0 }, expiryDate: { lte: todayDate } } }),
    db.customer.aggregate({ where: { balance: { gt: 0 } }, _sum: { balance: true } }),
    db.supplier.aggregate({ where: { balance: { gt: 0 } }, _sum: { balance: true } }),
    lowStockMedicines(),
    db.sale.findMany({ where: { date: pkRange(addDays(today, -6), today) }, select: { date: true, total: true } }),
  ]);


  // Last 7 days totals for the mini bar list
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const byDay = new Map(days.map((d) => [d, 0]));
  for (const s of week) {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(s.date);
    byDay.set(d, (byDay.get(d) ?? 0) + num(s.total));
  }
  const maxDay = Math.max(1, ...byDay.values());

  return (
    <>
      {sp.denied && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">You don&apos;t have access to that page.</div>
      )}
      <PageHeader
        title={`Welcome, ${user.name}`}
        subtitle="Today's overview of your store"
        actions={
          <>
            <LinkButton href="/pos"><ShoppingCart className="size-4" /> New Sale</LinkButton>
            {can(user.role, "purchases") && <LinkButton href="/purchases/new" variant="secondary"><PackagePlus className="size-4" /> New Purchase</LinkButton>}
            {can(user.role, "medicines") && <LinkButton href="/medicines/new" variant="secondary"><Pill className="size-4" /> Add Medicine</LinkButton>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Today's sale" value={money(todayS.netSales)} hint={`${todayS.invoices} invoices${todayS.returnTotal ? ` · returns ${money(todayS.returnTotal)}` : ""}`} />
        {showMoney ? (
          <Stat label="Today's gross profit" value={money(todayS.grossProfit)} tone="good" hint={`Month net profit: ${money(monthS.netProfit)}`} />
        ) : (
          <Stat label="Month sale" value={money(monthS.netSales)} />
        )}
        <Stat label="Low stock items" value={low.length} tone={low.length ? "warn" : "default"} href={showMoney ? "/stock?view=low" : undefined} hint="At or below reorder level" />
        <Stat label="Expired in stock" value={expiredCount} tone={expiredCount ? "bad" : "default"} href={showMoney ? "/stock?view=expired" : undefined} hint="Batches — remove from shelf" />
        <Stat label="Receivable (udhaar)" value={money(receivable._sum.balance)} href="/customers" hint="Customers owe you" />
        {showMoney && <Stat label="Payable" value={money(payable._sum.balance)} href="/suppliers" hint="You owe suppliers" />}
        {showMoney && <Stat label="Month sale" value={money(monthS.netSales)} hint={`Expenses: ${money(monthS.expenseTotal)}`} />}
        <Stat label="Near expiry" value={nearExpiry.length >= 8 ? "8+" : nearExpiry.length} tone={nearExpiry.length ? "warn" : "default"} href={showMoney ? "/stock?view=near" : undefined} hint={`Within ${settings.nearExpiryDays} days`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Last 7 days" className="lg:col-span-1">
          <ul className="space-y-2">
            {days.map((d) => {
              const v = byDay.get(d) ?? 0;
              return (
                <li key={d} className="grid grid-cols-[70px_1fr_90px] items-center gap-2 text-sm">
                  <span className="text-slate-500">{new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit" })}</span>
                  <span className="h-2.5 rounded-full bg-slate-100">
                    <span className="block h-2.5 rounded-full bg-brand-500" style={{ width: `${(v / maxDay) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{money(v)}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Recent sales" className="lg:col-span-2" actions={<Link href="/sales" className="text-sm text-brand-700 hover:underline">View all</Link>}>
          <Table className="border-0 shadow-none">
            <thead>
              <tr><th>Invoice</th><th>Time</th><th>Customer</th><th>Payment</th><th className="text-right!">Total</th></tr>
            </thead>
            <tbody>
              {recent.length === 0 && <Empty colSpan={5}>No sales yet</Empty>}
              {recent.map((s) => (
                <tr key={s.id}>
                  <td><Link className="font-medium text-brand-700 hover:underline" href={`/sales/${s.id}`}>{invoiceNo(s.number)}</Link></td>
                  <td className="text-slate-500">{fmtDateTime(s.date)}</td>
                  <td>{s.customer?.name ?? "Walk-in"}</td>
                  <td><Badge color={s.paymentMethod === "CREDIT" ? "amber" : "gray"}>{s.paymentMethod}</Badge></td>
                  <td className="text-right tabular-nums">{money(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title="Low stock" className="lg:col-span-1">
          {low.length === 0 ? (
            <p className="text-sm text-slate-400">All items above reorder level.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {low.slice(0, 8).map((m) => (
                <li key={m.id} className="flex justify-between gap-2 py-2">
                  <span className="truncate">{m.name} {m.strength}</span>
                  <span className={m.stock === 0 ? "text-red-600" : "text-amber-600"}>{fmtQty(m.stock, m.unitsPerPack, m.packName, m.unitName)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Expiring soon" className="lg:col-span-2">
          <Table className="border-0 shadow-none">
            <thead>
              <tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Qty</th></tr>
            </thead>
            <tbody>
              {nearExpiry.length === 0 && <Empty colSpan={4}>Nothing expiring in {settings.nearExpiryDays} days</Empty>}
              {nearExpiry.map((b) => (
                <tr key={b.id}>
                  <td>{b.medicine.name} {b.medicine.strength}</td>
                  <td className="font-mono text-xs">{b.batchNo}</td>
                  <td><Badge color={daysUntil(b.expiryDate) <= 30 ? "red" : "amber"}>{fmtExpiry(b.expiryDate)} · {daysUntil(b.expiryDate)}d</Badge></td>
                  <td>{fmtQty(b.quantity, b.medicine.unitsPerPack, b.medicine.packName, b.medicine.unitName)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
