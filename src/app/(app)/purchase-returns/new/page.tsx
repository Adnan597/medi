import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PurchaseReturnForm } from "./return-form";

export const metadata = { title: "Return to Supplier" };

export default async function NewPurchaseReturnPage() {
  await requireUser("purchases");
  const suppliers = await db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Return to Supplier" subtitle="Stock is removed and the amount is credited to the supplier's account." />
      <PurchaseReturnForm suppliers={suppliers} />
    </>
  );
}
