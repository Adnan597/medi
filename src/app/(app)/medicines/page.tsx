import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sellableStockMap } from "@/lib/queries";
import { fmtQty, money, num } from "@/lib/format";
import { Badge, Empty, LinkButton, PageHeader, SearchBar, Select, Table } from "@/components/ui";
import { Pager, pageOf } from "@/components/pager";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Medicines" };
const PAGE_SIZE = 20;

export default async function MedicinesPage(props: PageProps<"/medicines">) {
  await requireUser("medicines");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const categoryId = typeof sp.category === "string" ? sp.category : "";
  const status = typeof sp.status === "string" ? sp.status : "active";
  const page = pageOf(sp);

  const where: Prisma.MedicineWhereInput = {
    ...(status === "all" ? {} : { active: status === "active" }),
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { genericName: { contains: q, mode: "insensitive" } },
            { barcode: q },
          ],
        }
      : {}),
  };

  const [meds, categories, stock] = await Promise.all([
    db.medicine.findMany({
      where,
      include: { category: true, manufacturer: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    sellableStockMap(),
  ]);
  const hasMore = meds.length > PAGE_SIZE;

  return (
    <>
      {sp.saved && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">Medicine saved successfully.</div>}
      <PageHeader title="Medicines" subtitle="Your product catalogue" actions={<LinkButton href="/medicines/new"><Plus className="size-4" /> Add Medicine</LinkButton>} />
      <SearchBar placeholder="Name, generic/salt or barcode" defaultValue={q}>
        <Select name="category" defaultValue={categoryId} className="w-44">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select name="status" defaultValue={status} className="w-32">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </Select>
      </SearchBar>

      <Table>
        <thead>
          <tr><th>Medicine</th><th>Generic / Salt</th><th>Category</th><th>Company</th><th>Pack</th><th className="text-right!">Price / pack</th><th>Stock</th><th>Rack</th><th className="text-right!">Action</th></tr>
        </thead>
        <tbody>
          {meds.length === 0 && <Empty colSpan={9}>No medicines found. <Link href="/medicines/new" className="text-brand-700 underline">Add one</Link></Empty>}
          {meds.slice(0, PAGE_SIZE).map((m) => {
            const s = stock.get(m.id) ?? 0;
            return (
              <tr key={m.id}>
                <td>
                  <Link href={`/medicines/${m.id}`} className="font-medium text-brand-700 hover:underline">{m.name}</Link>
                  <span className="text-slate-500"> {m.strength} · {m.form}</span>
                  <div className="mt-0.5 flex gap-1">
                    {!m.active && <Badge>Inactive</Badge>}
                    {m.requiresPrescription && <Badge color="blue">Rx</Badge>}
                    {m.isControlled && <Badge color="red">Controlled</Badge>}
                  </div>
                </td>
                <td className="text-slate-600">{m.genericName}</td>
                <td>{m.category?.name}</td>
                <td>{m.manufacturer?.name}</td>
                <td className="text-slate-600">{m.unitsPerPack > 1 ? `${m.packName} of ${m.unitsPerPack}` : m.packName}</td>
                <td className="text-right tabular-nums">
                  <div>{money(m.salePrice)}<span className="text-xs text-slate-500">/{m.packName}</span></div>
                  {m.unitsPerPack > 1 && (
                    <div className="text-xs text-slate-500">{money(num(m.salePrice) / m.unitsPerPack)}/{m.unitName}</div>
                  )}
                </td>
                <td>
                  <span className={s === 0 ? "text-red-600" : s <= m.reorderLevel ? "text-amber-600" : ""}>
                    {fmtQty(s, m.unitsPerPack, m.packName, m.unitName)}
                  </span>
                </td>
                <td className="text-slate-500">{m.rackLocation}</td>
                <td className="text-right">
                  <LinkButton href={`/medicines/${m.id}/edit`} variant="secondary" className="px-2.5 py-1 text-xs">
                    <Pencil className="size-3.5" /> Edit
                  </LinkButton>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Pager page={page} hasMore={hasMore} params={sp} />
    </>
  );
}
