"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createSale, type SaleInput } from "@/lib/services";
import { dateOnly, num, todayPK } from "@/lib/format";
import { errMsg } from "@/lib/utils";

export type PosMedicine = {
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  form: string;
  barcode: string | null;
  unitName: string;
  packName: string;
  unitsPerPack: number;
  allowLooseSale: boolean;
  requiresPrescription: boolean;
  isControlled: boolean;
  rackLocation: string | null;
  stock: number;
  batches: { id: string; batchNo: string; expiryDate: string; quantity: number; salePrice: number }[];
};

/** Search sellable medicines by name, salt, or exact barcode. */
export async function searchMedicines(query: string): Promise<PosMedicine[]> {
  await requireUser("pos");
  const q = query.trim();
  const today = dateOnly(todayPK());
  const meds = await db.medicine.findMany({
    where: {
      active: true,
      ...(q
        ? {
            OR: [
              { barcode: q },
              { name: { contains: q, mode: "insensitive" } },
              { genericName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { batches: { where: { quantity: { gt: 0 }, expiryDate: { gt: today } }, orderBy: { expiryDate: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (q) {
    const lower = q.toLowerCase();
    meds.sort((a, b) => {
      const score = (m: typeof a) => (m.barcode === q ? 0 : m.name.toLowerCase().startsWith(lower) ? 1 : 2);
      return score(a) - score(b);
    });
  }
  return meds.map((m) => ({
    id: m.id, name: m.name, genericName: m.genericName, strength: m.strength, form: m.form, barcode: m.barcode,
    unitName: m.unitName, packName: m.packName, unitsPerPack: m.unitsPerPack, allowLooseSale: m.allowLooseSale,
    requiresPrescription: m.requiresPrescription, isControlled: m.isControlled, rackLocation: m.rackLocation,
    stock: m.batches.reduce((s, b) => s + b.quantity, 0),
    batches: m.batches.map((b) => ({
      id: b.id, batchNo: b.batchNo, expiryDate: b.expiryDate.toISOString(), quantity: b.quantity, salePrice: num(b.salePrice),
    })),
  }));
}

export async function completeSale(input: SaleInput): Promise<{ ok: true; saleId: string; number: number } | { ok: false; error: string }> {
  const user = await requireUser("pos");
  try {
    const sale = await createSale(input, user.id);
    revalidatePath("/sales");
    revalidatePath("/");
    return { ok: true, saleId: sale.id, number: sale.number };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0].message };
    return { ok: false, error: errMsg(e) };
  }
}

export async function quickAddCustomer(name: string, phone: string) {
  await requireUser("customers");
  if (!name.trim()) return { ok: false as const, error: "Name is required" };
  const c = await db.customer.create({ data: { name: name.trim(), phone: phone.trim() || null } });
  return { ok: true as const, customer: { id: c.id, name: c.name, phone: c.phone, balance: 0 } };
}
