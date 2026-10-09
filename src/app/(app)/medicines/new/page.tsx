import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { MedicineForm } from "../medicine-form";

export const metadata = { title: "Add Medicine" };

export default async function NewMedicinePage() {
  await requireUser("medicines");
  const [categories, manufacturers] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.manufacturer.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Add Medicine" subtitle="After saving, add stock with a purchase or as opening stock." />
      <Card>
        <MedicineForm categories={categories.map((c) => c.name)} manufacturers={manufacturers.map((m) => m.name)} />
      </Card>
    </>
  );
}
