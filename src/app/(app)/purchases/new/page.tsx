import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PurchaseForm } from "./purchase-form";

export const metadata = { title: "New Purchase" };

export default async function NewPurchasePage() {
  await requireUser("purchases");
  const suppliers = await db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader
        title="New Purchase"
        subtitle={
          <>
            Enter the supplier&apos;s bill. Stock is added per batch with expiry.{" "}
            {suppliers.length === 0 && <Link href="/suppliers" className="text-brand-700 underline">Add a supplier first.</Link>}
          </>
        }
      />
      <PurchaseForm suppliers={suppliers} />
    </>
  );
}
