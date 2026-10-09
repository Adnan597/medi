import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, invoiceNo, money, num } from "@/lib/format";
import { Card, Empty, PageHeader, Table } from "@/components/ui";
import { CustomerForm, PaymentForm } from "@/components/party-forms";
import { LedgerTable } from "@/components/ledger-table";

export const metadata = { title: "Customer" };

export default async function CustomerPage(props: PageProps<"/customers/[id]">) {
  const user = await requireUser("customers");
  const { id } = await props.params;
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      ledgerEntries: { orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true } } } },
      sales: { orderBy: { date: "desc" }, take: 20 },
    },
  });
  if (!c) notFound();

  return (
    <>
      <PageHeader title={c.name} subtitle={<>{c.phone} · Balance due: <b className={num(c.balance) > 0 ? "text-amber-700" : ""}>{money(c.balance)}</b></>} />
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="Receive payment"><PaymentForm party="customer" id={c.id} isAdmin={user.role === "ADMIN"} /></Card>
        <Card title="Edit customer" className="lg:col-span-2">
          <CustomerForm c={{ id: c.id, name: c.name, phone: c.phone, address: c.address, creditLimit: num(c.creditLimit) }} />
        </Card>
      </div>
      <h2 className="mb-2 text-sm font-semibold">Account ledger (khata)</h2>
      <LedgerTable entries={c.ledgerEntries} balanceLabel="Due" />
      <h2 className="mt-6 mb-2 text-sm font-semibold">Recent purchases by this customer</h2>
      <Table>
        <thead><tr><th>Invoice</th><th>Date</th><th>Payment</th><th className="text-right!">Total</th><th className="text-right!">Paid</th></tr></thead>
        <tbody>
          {c.sales.length === 0 && <Empty colSpan={5}>No sales</Empty>}
          {c.sales.map((s) => (
            <tr key={s.id}>
              <td><Link href={`/sales/${s.id}`} className="text-brand-700 hover:underline">{invoiceNo(s.number)}</Link></td>
              <td className="text-slate-500">{fmtDateTime(s.date)}</td>
              <td>{s.paymentMethod}</td>
              <td className="text-right tabular-nums">{money(s.total)}</td>
              <td className="text-right tabular-nums">{money(s.paid)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
