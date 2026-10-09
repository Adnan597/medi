import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { money, num } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { PaymentForm, SupplierForm } from "@/components/party-forms";
import { LedgerTable } from "@/components/ledger-table";

export const metadata = { title: "Supplier" };

export default async function SupplierPage(props: PageProps<"/suppliers/[id]">) {
  const user = await requireUser("suppliers");
  const { id } = await props.params;
  const s = await db.supplier.findUnique({
    where: { id },
    include: { ledgerEntries: { orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true } } } } },
  });
  if (!s) notFound();

  return (
    <>
      <PageHeader
        title={s.name}
        subtitle={<>{s.phone} {s.contactPerson && `· ${s.contactPerson}`} · Balance payable: <b className={num(s.balance) > 0 ? "text-amber-700" : ""}>{money(s.balance)}</b></>}
      />
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="Record payment" className="lg:col-span-1"><PaymentForm party="supplier" id={s.id} isAdmin={user.role === "ADMIN"} /></Card>
        <Card title="Edit supplier" className="lg:col-span-2">
          <SupplierForm s={{ id: s.id, name: s.name, phone: s.phone, address: s.address, contactPerson: s.contactPerson }} />
        </Card>
      </div>
      <h2 className="mb-2 text-sm font-semibold">Account ledger (khata)</h2>
      <LedgerTable entries={s.ledgerEntries} balanceLabel="Payable" />
    </>
  );
}
