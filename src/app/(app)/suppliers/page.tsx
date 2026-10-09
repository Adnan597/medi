import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { money, num } from "@/lib/format";
import { Card, Empty, PageHeader, SearchBar, Table } from "@/components/ui";
import { EditSupplierButton, SupplierForm } from "@/components/party-forms";
import { Pager, pageOf } from "@/components/pager";

export const metadata = { title: "Suppliers" };
const PAGE_SIZE = 20;

export default async function SuppliersPage(props: PageProps<"/suppliers">) {
  await requireUser("suppliers");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = pageOf(sp);

  const suppliers = await db.supplier.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { purchases: true } } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  });
  const totalDue = suppliers.reduce((s, x) => s + Math.max(num(x.balance), 0), 0);

  return (
    <>
      <PageHeader title="Suppliers / Distributors" subtitle={<>Total payable: <b>{money(totalDue)}</b></>} />
      <Card title="Add supplier" className="mb-5"><SupplierForm /></Card>
      <SearchBar placeholder="Name or phone" defaultValue={q} />
      <Table>
        <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Purchases</th><th className="text-right!">Balance (payable)</th><th className="text-right!">Action</th></tr></thead>
        <tbody>
          {suppliers.length === 0 && <Empty colSpan={6}>No suppliers yet</Empty>}
          {suppliers.slice(0, PAGE_SIZE).map((s) => (
            <tr key={s.id}>
              <td><Link href={`/suppliers/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.name}</Link></td>
              <td>{s.contactPerson}</td>
              <td>{s.phone}</td>
              <td>{s._count.purchases}</td>
              <td className={`text-right tabular-nums ${num(s.balance) > 0 ? "font-medium text-amber-700" : ""}`}>{money(s.balance)}</td>
              <td className="text-right">
                <EditSupplierButton s={{ id: s.id, name: s.name, phone: s.phone, address: s.address, contactPerson: s.contactPerson }} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager page={page} hasMore={suppliers.length > PAGE_SIZE} params={sp} />
    </>
  );
}
