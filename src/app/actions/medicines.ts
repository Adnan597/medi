"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addOpeningStock, adjustStock } from "@/lib/services";
import { errMsg, str, type ActionResult } from "@/lib/utils";

const medicineSchema = z.object({
  name: z.string().min(1, "Name is required"),
  genericName: z.string().nullable(),
  form: z.string().min(1),
  strength: z.string().nullable(),
  barcode: z.string().nullable(),
  unitName: z.string().min(1),
  packName: z.string().min(1),
  unitsPerPack: z.coerce.number().int().min(1, "Units per pack must be at least 1"),
  salePrice: z.coerce.number().min(0),
  reorderPacks: z.coerce.number().min(0),
  rackLocation: z.string().nullable(),
  allowLooseSale: z.boolean(),
  requiresPrescription: z.boolean(),
  isControlled: z.boolean(),
});

async function findOrCreate(model: "category" | "manufacturer", name: string | null) {
  if (!name) return null;
  if (model === "category") {
    return (await db.category.upsert({ where: { name }, create: { name }, update: {} })).id;
  }
  return (await db.manufacturer.upsert({ where: { name }, create: { name }, update: {} })).id;
}

export async function saveMedicine(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser("medicines");
  const id = str(fd, "id");
  const parsed = medicineSchema.safeParse({
    name: str(fd, "name") ?? "",
    genericName: str(fd, "genericName"),
    form: str(fd, "form") ?? "Tablet",
    strength: str(fd, "strength"),
    barcode: str(fd, "barcode"),
    unitName: str(fd, "unitName") ?? "Tablet",
    packName: str(fd, "packName") ?? "Strip",
    unitsPerPack: str(fd, "unitsPerPack") ?? 1,
    salePrice: str(fd, "salePrice") ?? 0,
    reorderPacks: str(fd, "reorderPacks") ?? 0,
    rackLocation: str(fd, "rackLocation"),
    allowLooseSale: fd.get("allowLooseSale") === "on",
    requiresPrescription: fd.get("requiresPrescription") === "on",
    isControlled: fd.get("isControlled") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { reorderPacks, ...d } = parsed.data;

  let savedId: string;
  try {
    const data = {
      ...d,
      reorderLevel: Math.round(reorderPacks * d.unitsPerPack),
      categoryId: await findOrCreate("category", str(fd, "category")),
      manufacturerId: await findOrCreate("manufacturer", str(fd, "manufacturer")),
    };
    if (id) {
      // Changing pack size would silently change stock meaning if batches exist.
      const existing = await db.medicine.findUniqueOrThrow({ where: { id }, include: { _count: { select: { batches: true } } } });
      if (existing.unitsPerPack !== data.unitsPerPack && existing._count.batches > 0) {
        return { ok: false, error: "Units per pack cannot be changed after stock has been added. Create a new medicine instead." };
      }
      await db.medicine.update({ where: { id }, data });
      savedId = id;
    } else {
      savedId = (await db.medicine.create({ data })).id;

      // Automatically add initial stock if provided
      const initialPacks = Number(fd.get("initialPacks") || 0);
      const initialUnits = Number(fd.get("initialUnits") || 0);
      if (initialPacks > 0 || initialUnits > 0) {
        const initialCostPrice = Number(fd.get("initialCostPrice") || 0);
        const rawBatchNo = str(fd, "batchNo");
        const rawExpiryDate = str(fd, "expiryDate");

        const batchNo = rawBatchNo || `OP-${Math.floor(1000 + Math.random() * 9000)}`;
        const defaultExpiry = new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const expiryDate = rawExpiryDate || defaultExpiry;

        await addOpeningStock(
          {
            medicineId: savedId,
            batchNo,
            expiryDate,
            costPrice: initialCostPrice,
            salePrice: d.salePrice,
            packs: initialPacks,
            units: initialUnits,
          },
          user.id,
        );
      }
    }
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidatePath("/medicines");
  if (id) {
    redirect(`/medicines/${savedId}?saved=1`);
  } else {
    redirect(`/medicines?saved=1`);
  }
}

export async function toggleMedicine(fd: FormData) {
  await requireUser("medicines");
  const id = String(fd.get("id"));
  const m = await db.medicine.findUniqueOrThrow({ where: { id } });
  await db.medicine.update({ where: { id }, data: { active: !m.active } });
  revalidatePath(`/medicines/${id}`);
}

export async function openingStockAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser("stock");
  try {
    await addOpeningStock(
      {
        medicineId: String(fd.get("medicineId")),
        batchNo: String(fd.get("batchNo") ?? ""),
        expiryDate: String(fd.get("expiryDate") ?? ""),
        costPrice: Number(fd.get("costPrice") || 0),
        salePrice: Number(fd.get("salePrice") || 0),
        packs: Number(fd.get("packs") || 0),
        units: Number(fd.get("units") || 0),
      },
      user.id,
    );
  } catch (e) {
    return { ok: false, error: e instanceof z.ZodError ? e.issues[0].message : errMsg(e) };
  }
  revalidatePath(`/medicines/${fd.get("medicineId")}`);
  return { ok: true, message: "Stock added" };
}

export async function adjustStockAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser("stock");
  const direction = fd.get("direction") === "add" ? 1 : -1;
  const type = fd.get("type") === "EXPIRED" ? "EXPIRED" : "ADJUSTMENT";
  const unitsPerPack = Number(fd.get("unitsPerPack") || 1);
  const qty = Number(fd.get("packs") || 0) * unitsPerPack + Number(fd.get("units") || 0);
  try {
    await adjustStock(
      { batchId: String(fd.get("batchId")), quantity: direction * qty, type, note: str(fd, "note") ?? undefined },
      user.id,
    );
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidatePath("/stock");
  revalidatePath(`/medicines/${fd.get("medicineId")}`);
  return { ok: true, message: "Stock updated" };
}

/** Quick edit of a batch's sale price / expiry (e.g. price change by company). */
export async function updateBatchAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser("stock");
  const batchId = String(fd.get("batchId"));
  const salePrice = Number(fd.get("salePrice"));
  const expiry = String(fd.get("expiryDate") ?? "");
  if (!(salePrice >= 0) || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return { ok: false, error: "Enter valid price and expiry" };
  await db.batch.update({ where: { id: batchId }, data: { salePrice, expiryDate: new Date(`${expiry}T00:00:00Z`) } });
  revalidatePath(`/medicines/${fd.get("medicineId")}`);
  return { ok: true, message: "Batch updated" };
}
