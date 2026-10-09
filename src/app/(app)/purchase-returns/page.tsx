import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, invoiceNo, money } from "@/lib/format";
import { Empty, LinkButton, PageHeader, Table } from "@/components/ui";
import { Pager, pageOf } from "@/components/pager";

export const metadata = { title: "Purchase Returns" };
const PAGE_SIZE = 20;

export default async function PurchaseReturnsPage(props: PageProps<"/purchase-returns">) {
  await requireUser("purchases");
  const sp = await props.searchParams;
  const page = pageOf(sp);
  const returns = await db.purchaseReturn.findMany({
    include: { supplier: { select: { name: true } }, user: { select: { name: true } }, items: { include: { batch: { include: { medicine: { select: { name: true } } } } } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  });
  return (
    <>
      {sp.saved && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">Return saved. Stock removed and supplier credited.</div>}
      <PageHeader title="Purchase Returns" subtitle="Stock sent back to suppliers" actions={<LinkButton href="/purchase-returns/new"><Plus className="size-4" /> New Return</LinkButton>} />
      <Table>
        <thead><tr><th>#</th><th>Date</th><th>Supplier</th><th>Items</th><th>Reason</th><th>By</th><th className="text-right!">Amount</th></tr></thead>
        <tbody>
          {returns.length === 0 && <Empty colSpan={7}>No returns yet</Empty>}
          {returns.slice(0, PAGE_SIZE).map((r) => (
            <tr key={r.id}>
              <td className="font-medium">{invoiceNo(r.number, "PRT")}</td>
              <td className="text-slate-500">{fmtDateTime(r.createdAt)}</td>
              <td>{r.supplier.name}</td>
              <td className="max-w-md text-slate-600">{r.items.map((i) => `${i.batch.medicine.name} (${i.batch.batchNo}) × ${i.quantity}`).join(", ")}</td>
              <td className="text-slate-500">{r.reason}</td>
              <td>{r.user.name}</td>
              <td className="text-right tabular-nums">{money(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager page={page} hasMore={returns.length > PAGE_SIZE} params={sp} />
    </>
  );
}
