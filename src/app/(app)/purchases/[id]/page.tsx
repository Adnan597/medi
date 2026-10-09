import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtExpiry, invoiceNo, money } from "@/lib/format";
import { Card, PageHeader, Table } from "@/components/ui";

export const metadata = { title: "Purchase" };

export default async function PurchasePage(props: PageProps<"/purchases/[id]">) {
  await requireUser("purchases");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const p = await db.purchase.findUnique({
    where: { id },
    include: { supplier: true, user: { select: { name: true } }, items: { include: { medicine: true, batch: true } } },
  });
  if (!p) notFound();

  return (
    <>
      {sp.saved && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">Purchase saved and stock added.</div>}
      <PageHeader
        title={`Purchase ${invoiceNo(p.number, "PUR")}`}
        subtitle={<>{fmtDate(p.date)} · <Link href={`/suppliers/${p.supplierId}`} className="text-brand-700 hover:underline">{p.supplier.name}</Link>{p.invoiceNo && ` · Bill ${p.invoiceNo}`} · by {p.user.name}</>}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table>
            <thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Bonus</th><th className="text-right!">Cost</th><th>Disc</th><th className="text-right!">Sale</th><th className="text-right!">Amount</th></tr></thead>
            <tbody>
              {p.items.map((it) => (
                <tr key={it.id}>
                  <td><Link href={`/medicines/${it.medicineId}`} className="hover:underline">{it.medicine.name} {it.medicine.strength}</Link></td>
                  <td className="font-mono text-xs">{it.batch.batchNo}</td>
                  <td>{fmtExpiry(it.batch.expiryDate)}</td>
                  <td>{it.packs} {it.medicine.packName}</td>
                  <td>{it.bonusPacks || ""}</td>
                  <td className="text-right tabular-nums">{money(it.costPrice)}</td>
                  <td>{Number(it.discountPct) ? `${it.discountPct}%` : ""}</td>
                  <td className="text-right tabular-nums">{money(it.salePrice)}</td>
                  <td className="text-right tabular-nums">{money(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <Card title="Bill summary">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{money(p.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd>{money(p.discount)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Tax / charges</dt><dd>{money(p.tax)}</dd></div>
            <div className="flex justify-between border-t pt-1.5 font-semibold"><dt>Total</dt><dd>{money(p.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Paid at purchase</dt><dd>{money(p.paid)}</dd></div>
          </dl>
          {p.note && <p className="mt-3 text-sm text-slate-600">{p.note}</p>}
        </Card>
      </div>
    </>
  );
}
