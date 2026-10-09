import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { db } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { fmtDateTime, fmtExpiry, fmtQty, invoiceNo, money, num } from "@/lib/format";
import { Card, Empty, Input, PageHeader, Table } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { saleReturnAction } from "@/app/actions/sales";

export const metadata = { title: "Invoice" };

export default async function SalePage(props: PageProps<"/sales/[id]">) {
  const user = await requireUser("sales");
  const { id } = await props.params;
  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      user: { select: { name: true } },
      items: { include: { medicine: true, batch: true } },
      returns: { include: { user: { select: { name: true } }, items: { include: { saleItem: { include: { medicine: true } } } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!sale) notFound();
  if (user.role === "CASHIER" && sale.userId !== user.id) notFound();

  const showCost = can(user.role, "viewCost");
  const returnable = sale.items.filter((i) => i.quantity > i.returnedQty);
  const q = (n: number, m: (typeof sale.items)[number]["medicine"]) => fmtQty(n, m.unitsPerPack, m.packName, m.unitName);

  return (
    <>
      <PageHeader
        title={`Invoice ${invoiceNo(sale.number)}`}
        subtitle={`${fmtDateTime(sale.date)} · by ${sale.user.name} · ${sale.customer?.name ?? "Walk-in"}`}
        actions={
          <a href={`/receipt/${sale.id}`} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium hover:bg-slate-50">
            <Printer className="size-4" /> Print receipt
          </a>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table>
            <thead>
              <tr><th>Medicine</th><th>Batch</th><th>Qty</th><th className="text-right!">Rate/unit</th><th className="text-right!">Disc</th><th className="text-right!">Amount</th>{showCost && <th className="text-right!">Profit</th>}</tr>
            </thead>
            <tbody>
              {sale.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.medicine.name} {it.medicine.strength}</td>
                  <td className="font-mono text-xs">{it.batch.batchNo} · {fmtExpiry(it.batch.expiryDate)}</td>
                  <td>
                    {q(it.quantity, it.medicine)}
                    {it.returnedQty > 0 && <div className="text-xs text-red-600">Returned {q(it.returnedQty, it.medicine)}</div>}
                  </td>
                  <td className="text-right tabular-nums">{money(it.unitPrice)}</td>
                  <td className="text-right tabular-nums">{money(it.discount)}</td>
                  <td className="text-right tabular-nums">{money(it.lineTotal)}</td>
                  {showCost && <td className="text-right tabular-nums text-emerald-700">{money(num(it.lineTotal) - num(it.unitCost) * it.quantity)}</td>}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <Card title="Payment">
          <dl className="space-y-1.5 text-sm">
            <Row k="Subtotal" v={money(sale.subtotal)} />
            <Row k="Discount" v={money(sale.discount)} />
            <Row k="Total" v={money(sale.total)} strong />
            <Row k={`Paid (${sale.paymentMethod})`} v={money(sale.paid)} />
            {num(sale.change) > 0 && <Row k="Change" v={money(sale.change)} />}
            {num(sale.total) > num(sale.paid) && <Row k="On credit" v={money(num(sale.total) - num(sale.paid))} />}
            {showCost && <Row k="Gross profit" v={money(num(sale.total) - num(sale.costTotal))} />}
            {sale.patientName && <Row k="Patient" v={sale.patientName} />}
            {sale.doctorName && <Row k="Doctor" v={sale.doctorName} />}
          </dl>
        </Card>
      </div>

      {returnable.length > 0 && (
        <Card title="Return items" className="mt-5">
          <ActionForm action={saleReturnAction}>
            <input type="hidden" name="saleId" value={sale.id} />
            <Table className="border-0 shadow-none">
              <thead><tr><th>Medicine</th><th>Can return</th><th>Return qty ({"base units"})</th></tr></thead>
              <tbody>
                {returnable.map((it) => (
                  <tr key={it.id}>
                    <td>{it.medicine.name} {it.medicine.strength} <span className="font-mono text-xs text-slate-500">{it.batch.batchNo}</span></td>
                    <td>{q(it.quantity - it.returnedQty, it.medicine)}</td>
                    <td className="flex items-center gap-2">
                      <Input type="number" name={`qty_${it.id}`} min={0} max={it.quantity - it.returnedQty} defaultValue={0} className="w-24" />
                      <span className="text-xs text-slate-500">{it.medicine.unitName}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input name="reason" placeholder="Reason (optional)" className="max-w-sm" />
              <SubmitButton variant="danger">Save return</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      )}

      <Card title="Returns" className="mt-5">
        <Table className="border-0 shadow-none">
          <thead><tr><th>Date</th><th>Items</th><th>By</th><th>Reason</th><th className="text-right!">Amount</th></tr></thead>
          <tbody>
            {sale.returns.length === 0 && <Empty colSpan={5}>No returns</Empty>}
            {sale.returns.map((r) => (
              <tr key={r.id}>
                <td className="text-slate-500">{fmtDateTime(r.createdAt)}</td>
                <td>{r.items.map((i) => `${i.saleItem.medicine.name} × ${i.quantity}`).join(", ")}</td>
                <td>{r.user.name}</td>
                <td className="text-slate-500">{r.reason}</td>
                <td className="text-right tabular-nums text-red-600">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-slate-100 pt-1.5 text-base font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-slate-500"}>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
