import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fmtDateTime, fmtExpiry, fmtQty, invoiceNo, money, num } from "@/lib/format";
import { PrintButton } from "./print-button";
import { poweredBy } from "@/lib/brand";

export const metadata = { title: "Receipt" };

// 80mm thermal receipt. Opened in a hidden iframe by the POS, or directly to reprint.
export default async function ReceiptPage(props: PageProps<"/receipt/[id]">) {
  await requireUser("sales");
  const { id } = await props.params;
  const [sale, s] = await Promise.all([
    db.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        user: { select: { name: true } },
        items: { include: { medicine: true, batch: { select: { batchNo: true, expiryDate: true } } } },
      },
    }),
    getSettings(),
  ]);
  if (!sale) notFound();
  const due = Math.max(num(sale.total) - num(sale.paid), 0);

  return (
    <div className="mx-auto w-[76mm] bg-white p-2 font-mono text-[11px] leading-snug text-black">
      <style>{`@page { size: 80mm auto; margin: 2mm; } body { background: white !important; }`}</style>
      <div className="text-center">
        {s.showLogoOnReceipt && s.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- served from our DB
          <img src={s.logoUrl} alt="" className="mx-auto mb-1 max-h-14 max-w-[40mm] object-contain grayscale" />
        )}
        <div className="text-sm font-bold">{s.storeName}</div>
        {s.tagline && <div>{s.tagline}</div>}
        {s.address && <div>{s.address}</div>}
        {s.phone && <div className="font-bold">Ph: {s.phone}</div>}
        {s.email && <div>{s.email}</div>}
        {(s.licenseNo || s.ntn) && <div>{[s.licenseNo && `Lic: ${s.licenseNo}`, s.ntn && `NTN: ${s.ntn}`].filter(Boolean).join(" · ")}</div>}
      </div>
      <div className="my-1.5 border-t border-dashed border-black" />
      <div className="flex justify-between"><span>{invoiceNo(sale.number)}</span><span>{fmtDateTime(sale.date)}</span></div>
      <div>Customer: {sale.customer?.name ?? "Walk-in"} {sale.customer?.phone ? `(${sale.customer.phone})` : ""}</div>
      {sale.patientName && <div>Patient: {sale.patientName}</div>}
      {sale.doctorName && <div>Doctor: {sale.doctorName}</div>}
      <div className="my-1.5 border-t border-dashed border-black" />
      <table className="w-full">
        <thead>
          <tr className="text-left"><th>Item</th><th className="text-right">Qty</th><th className="text-right">Amt</th></tr>
        </thead>
        <tbody>
          {sale.items.map((it) => (
            <tr key={it.id} className="align-top">
              <td className="pr-1">
                {it.medicine.name} {it.medicine.strength}
                <div className="text-[9px]">B:{it.batch.batchNo} E:{fmtExpiry(it.batch.expiryDate)}</div>
              </td>
              <td className="text-right whitespace-nowrap">{fmtQty(it.quantity, it.medicine.unitsPerPack, it.medicine.packName.slice(0, 3), it.medicine.unitName.slice(0, 3))}</td>
              <td className="text-right">{num(it.lineTotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="my-1.5 border-t border-dashed border-black" />
      <div className="space-y-0.5">
        <Row label="Subtotal" value={money(sale.subtotal)} />
        {num(sale.discount) > 0 && <Row label="Discount" value={`-${money(sale.discount)}`} />}
        <Row label="TOTAL" value={money(sale.total)} bold />
        <Row label={`Paid (${sale.paymentMethod})`} value={money(sale.paid)} />
        {num(sale.change) > 0 && <Row label="Change" value={money(sale.change)} />}
        {due > 0 && <Row label="Balance due" value={money(due)} bold />}
      </div>
      <div className="my-1.5 border-t border-dashed border-black" />
      {s.receiptFooter && <div className="text-center">{s.receiptFooter}</div>}
      <PrintButton />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-[12px] font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
