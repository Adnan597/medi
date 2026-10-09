import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { num } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { MedicineForm } from "../../medicine-form";

export const metadata = { title: "Edit Medicine" };

export default async function EditMedicinePage(props: PageProps<"/medicines/[id]/edit">) {
  await requireUser("medicines");
  const { id } = await props.params;

  const med = await db.medicine.findUnique({
    where: { id },
    include: {
      category: true,
      manufacturer: true,
      batches: { select: { id: true } },
    },
  });
  if (!med) notFound();

  const [categories, manufacturers] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.manufacturer.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title={`Edit: ${med.name}`}
        subtitle={`${med.genericName ? `${med.genericName} · ` : ""}${med.form} ${med.strength ?? ""}`}
        actions={
          <Link
            href={`/medicines/${med.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="size-4" /> Back to details
          </Link>
        }
      />
      <Card>
        <MedicineForm
          categories={categories.map((c) => c.name)}
          manufacturers={manufacturers.map((m) => m.name)}
          values={{
            id: med.id,
            name: med.name,
            genericName: med.genericName,
            form: med.form,
            strength: med.strength,
            barcode: med.barcode,
            category: med.category?.name,
            manufacturer: med.manufacturer?.name,
            unitName: med.unitName,
            packName: med.packName,
            unitsPerPack: med.unitsPerPack,
            salePrice: num(med.salePrice),
            reorderPacks: med.reorderLevel / med.unitsPerPack,
            rackLocation: med.rackLocation,
            allowLooseSale: med.allowLooseSale,
            requiresPrescription: med.requiresPrescription,
            isControlled: med.isControlled,
            hasStock: med.batches.length > 0,
          }}
        />
      </Card>
    </>
  );
}
