"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createPurchase, createPurchaseReturn, purchaseReturnSchema, purchaseSchema } from "@/lib/services";
import { dateOnly, num, todayPK } from "@/lib/format";
import { errMsg } from "@/lib/utils";

export type CatalogItem = {
  id: string;
  name: string;
  strength: string | null;
  genericName: string | null;
  packName: string;
  unitName: string;
  unitsPerPack: number;
  salePrice: number;
  lastCost: number | null;
  lastBatchNo?: string | null;
  lastExpiryDate?: string | null;
  lastPacks?: number | null;
};

export async function searchCatalog(query: string): Promise<CatalogItem[]> {
  await requireUser("purchases");
  const q = query.trim();
  const meds = await db.medicine.findMany({
    where: q
      ? {
          OR: [{ barcode: q }, { name: { contains: q, mode: "insensitive" } }, { genericName: { contains: q, mode: "insensitive" } }],
        }
      : {},
    include: {
      purchaseItems: {
        orderBy: { purchase: { date: "desc" } },
        take: 1,
        select: { costPrice: true, packs: true, batch: { select: { batchNo: true, expiryDate: true } } },
      },
      // Fallback for stock that came in as opening stock (no purchase yet)
      batches: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { costPrice: true, batchNo: true, expiryDate: true, quantity: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return meds.map((m) => {
    const pi = m.purchaseItems[0];
    const b = m.batches[0];

    const lastCost = pi ? num(pi.costPrice) : b ? num(b.costPrice) : null;
    const lastBatchNo = pi ? pi.batch.batchNo : b ? b.batchNo : null;
    const rawExpiry = pi ? pi.batch.expiryDate : b ? b.expiryDate : null;
    const lastExpiryDate = rawExpiry ? new Date(rawExpiry).toISOString().slice(0, 10) : null;
    const lastPacks = pi ? pi.packs : b ? Math.max(Math.round(b.quantity / m.unitsPerPack), 1) : 1;

    return {
      id: m.id,
      name: m.name,
      strength: m.strength,
      genericName: m.genericName,
      packName: m.packName,
      unitName: m.unitName,
      unitsPerPack: m.unitsPerPack,
      salePrice: num(m.salePrice),
      lastCost,
      lastBatchNo,
      lastExpiryDate,
      lastPacks,
    };
  });
}

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function savePurchase(input: z.input<typeof purchaseSchema>): Promise<Result> {
  const user = await requireUser("purchases");
  try {
    const p = await createPurchase(purchaseSchema.parse(input), user.id);
    revalidatePath("/purchases");
    revalidatePath("/stock");
    return { ok: true, id: p.id };
  } catch (e) {
    return { ok: false, error: e instanceof z.ZodError ? e.issues[0].message : errMsg(e) };
  }
}

export type ReturnableBatch = {
  id: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
  medicine: { name: string; strength: string | null; unitsPerPack: number; packName: string; unitName: string };
};

/** Batches in stock matching a medicine name (for returning to supplier). Includes expired. */
export async function searchBatches(query: string, supplierId?: string): Promise<ReturnableBatch[]> {
  await requireUser("purchases");
  const q = query.trim();
  const expiredOnly = q === ":expired";
  const batches = await db.batch.findMany({
    where: {
      quantity: { gt: 0 },
      ...(supplierId ? { purchaseItems: { some: { purchase: { supplierId } } } } : {}),
      ...(expiredOnly
        ? { expiryDate: { lte: dateOnly(todayPK()) } }
        : q
        ? { OR: [{ batchNo: q }, { medicine: { name: { contains: q, mode: "insensitive" } } }] }
        : {}),
    },
    include: { medicine: true },
    orderBy: { expiryDate: "asc" },
    take: 30,
  });
  return batches.map((b) => ({
    id: b.id, batchNo: b.batchNo, expiryDate: b.expiryDate.toISOString(), quantity: b.quantity, costPrice: num(b.costPrice),
    medicine: { name: b.medicine.name, strength: b.medicine.strength, unitsPerPack: b.medicine.unitsPerPack, packName: b.medicine.packName, unitName: b.medicine.unitName },
  }));
}

export async function savePurchaseReturn(input: z.input<typeof purchaseReturnSchema>): Promise<Result> {
  const user = await requireUser("purchases");
  try {
    const r = await createPurchaseReturn(purchaseReturnSchema.parse(input), user.id);
    revalidatePath("/purchase-returns");
    revalidatePath("/stock");
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof z.ZodError ? e.issues[0].message : errMsg(e) };
  }
}
