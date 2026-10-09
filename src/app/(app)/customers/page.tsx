import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { money, num } from "@/lib/format";
import { Card, Empty, PageHeader, SearchBar, Select, Table } from "@/components/ui";
import { CustomerForm, EditCustomerButton } from "@/components/party-forms";
import { Pager, pageOf } from "@/components/pager";

export const metadata = { title: "Customers" };
const PAGE_SIZE = 20;

export default async function CustomersPage(props: PageProps<"/customers">) {
  await requireUser("customers");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const dueOnly = sp.due === "1";
  const page = pageOf(sp);

  const customers = await db.customer.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
      ...(dueOnly ? { balance: { gt: 0 } } : {}),
    },
    orderBy: dueOnly ? { balance: "desc" } : { name: "asc" },
    include: { _count: { select: { sales: true } } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  });
  const totalDue = customers.reduce((s, x) => s + Math.max(num(x.balance), 0), 0);

  return (
    <>
      <PageHeader title="Customers" subtitle={<>Total receivable (udhaar): <b>{money(totalDue)}</b></>} />
      <Card title="Add customer" className="mb-5"><CustomerForm /></Card>
      <SearchBar placeholder="Name or phone" defaultValue={q}>
        <Select name="due" defaultValue={dueOnly ? "1" : ""} className="w-40">
          <option value="">All customers</option>
          <option value="1">With dues only</option>
        </Select>
      </SearchBar>
      <Table>
        <thead><tr><th>Name</th><th>Phone</th><th>Sales</th><th className="text-right!">Credit limit</th><th className="text-right!">Balance due</th><th className="text-right!">Action</th></tr></thead>
        <tbody>
          {customers.length === 0 && <Empty colSpan={6}>No customers</Empty>}
          {customers.slice(0, PAGE_SIZE).map((c) => (
            <tr key={c.id}>
              <td><Link href={`/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link></td>
              <td>{c.phone}</td>
              <td>{c._count.sales}</td>
              <td className="text-right tabular-nums">{num(c.creditLimit) ? money(c.creditLimit) : "—"}</td>
              <td className={`text-right tabular-nums ${num(c.balance) > 0 ? "font-medium text-amber-700" : ""}`}>{money(c.balance)}</td>
              <td className="text-right">
                <EditCustomerButton c={{ id: c.id, name: c.name, phone: c.phone, address: c.address, creditLimit: num(c.creditLimit) }} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager page={page} hasMore={customers.length > PAGE_SIZE} params={sp} />
    </>
  );
}
