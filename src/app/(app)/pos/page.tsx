import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { num } from "@/lib/format";
import { PosClient } from "./pos-client";

export const metadata = { title: "POS" };

export default async function PosPage() {
  await requireUser("pos");
  const customers = await db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, phone: true, balance: true } });
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">New Sale</h1>
      <PosClient customers={customers.map((c) => ({ ...c, balance: num(c.balance) }))} walkInLabel="Walk-in customer" />
    </>
  );
}
