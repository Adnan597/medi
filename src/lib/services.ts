import "server-only";
import { z } from "zod";
import { db, type Tx } from "./db";
import { dateOnly, num, round2, todayPK } from "./format";
import { allocateFEFO } from "./fefo";
import type { LedgerType, MovementType, PaymentMethod } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Ledger (khata) — keeps party balance and history in sync.
// ---------------------------------------------------------------------------

type LedgerInput = {
  supplierId?: string;
  customerId?: string;
  type: LedgerType;
  amount: number; // signed change in balance
  refId?: string;
  note?: string;
  userId: string;
};

export async function addLedger(tx: Tx, e: LedgerInput) {
  const amount = round2(e.amount);
  if (amount === 0) return;
  let balance: number;
  if (e.supplierId) {
    const s = await tx.supplier.update({ where: { id: e.supplierId }, data: { balance: { increment: amount } } });
    balance = num(s.balance);
  } else if (e.customerId) {
    const c = await tx.customer.update({ where: { id: e.customerId }, data: { balance: { increment: amount } } });
    balance = num(c.balance);
  } else {
    throw new Error("Ledger entry needs a supplier or customer");
  }
  await tx.ledgerEntry.create({
    data: {
      supplierId: e.supplierId, customerId: e.customerId, type: e.type, amount, balance,
      refId: e.refId, note: e.note, userId: e.userId,
    },
  });
}

async function moveStock(
  tx: Tx,
  m: { batchId: string; medicineId: string; type: MovementType; quantity: number; refId?: string; note?: string; userId: string },
) {
  if (m.quantity === 0) return;
  if (m.quantity < 0) {
    // Conditional decrement: fails safely if another sale took the stock first.
    const res = await tx.batch.updateMany({
      where: { id: m.batchId, quantity: { gte: -m.quantity } },
      data: { quantity: { increment: m.quantity } },
    });
    if (res.count === 0) throw new Error("Not enough stock in batch — please refresh and try again.");
  } else {
    await tx.batch.update({ where: { id: m.batchId }, data: { quantity: { increment: m.quantity } } });
  }
  await tx.stockMovement.create({ data: m });
}

/** Cost per pack when new stock joins an existing batch: weighted by quantity. */
async function blendedCost(tx: Tx, medicineId: string, batchNo: string, addUnits: number, addCostPerPack: number) {
  const existing = await tx.batch.findUnique({ where: { medicineId_batchNo: { medicineId, batchNo } } });
  if (!existing || existing.quantity <= 0) return addCostPerPack;
  const total = existing.quantity + addUnits;
  return round2((num(existing.costPrice) * existing.quantity + addCostPerPack * addUnits) / total);
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

export const purchaseSchema = z.object({
  supplierId: z.string().min(1, "Select a supplier"),
  invoiceNo: z.string().trim().optional().nullable(),
  date: z.string().optional(), // YYYY-MM-DD
  discount: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  paid: z.coerce.number().min(0).default(0),
  note: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        medicineId: z.string().min(1),
        batchNo: z.string().trim().min(1, "Batch no. is required"),
        expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date is required"),
        packs: z.coerce.number().int().min(0),
        bonusPacks: z.coerce.number().int().min(0).default(0),
        costPrice: z.coerce.number().min(0),
        salePrice: z.coerce.number().min(0),
        discountPct: z.coerce.number().min(0).max(100).default(0),
      }),
    )
    .min(1, "Add at least one item"),
});

export async function createPurchase(input: z.infer<typeof purchaseSchema>, userId: string) {
  const data = purchaseSchema.parse(input);
  for (const it of data.items) {
    if (it.packs + it.bonusPacks <= 0) throw new Error("Quantity must be more than zero");
  }

  return db.$transaction(async (tx) => {
    const meds = await tx.medicine.findMany({ where: { id: { in: data.items.map((i) => i.medicineId) } } });
    const medMap = new Map(meds.map((m) => [m.id, m]));

    const lines = data.items.map((it) => {
      const lineTotal = round2(it.packs * it.costPrice * (1 - it.discountPct / 100));
      return { ...it, lineTotal };
    });
    const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    const total = round2(subtotal - data.discount + data.tax);
    if (total < 0) throw new Error("Total cannot be negative");
    // Bill-level discount/tax is spread over items so batch cost stays accurate.
    const factor = subtotal > 0 ? total / subtotal : 1;

    const purchase = await tx.purchase.create({
      data: {
        supplierId: data.supplierId,
        invoiceNo: data.invoiceNo || null,
        date: data.date ? new Date(`${data.date}T12:00:00+05:00`) : new Date(),
        subtotal, discount: data.discount, tax: data.tax, total, paid: Math.min(data.paid, total),
        note: data.note || null, userId,
      },
    });

    for (const l of lines) {
      const med = medMap.get(l.medicineId);
      if (!med) throw new Error("Medicine not found");
      const totalPacks = l.packs + l.bonusPacks;
      const netCostPerPack = round2((l.lineTotal * factor) / totalPacks);
      const units = totalPacks * med.unitsPerPack;

      const costPrice = await blendedCost(tx, med.id, l.batchNo, units, netCostPerPack);
      const batch = await tx.batch.upsert({
        where: { medicineId_batchNo: { medicineId: med.id, batchNo: l.batchNo } },
        create: {
          medicineId: med.id, batchNo: l.batchNo, expiryDate: dateOnly(l.expiryDate),
          costPrice, salePrice: l.salePrice, quantity: 0,
        },
        update: { expiryDate: dateOnly(l.expiryDate), costPrice, salePrice: l.salePrice },
      });

      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id, medicineId: med.id, batchId: batch.id, packs: l.packs, bonusPacks: l.bonusPacks,
          costPrice: l.costPrice, salePrice: l.salePrice, discountPct: l.discountPct, lineTotal: l.lineTotal,
        },
      });
      await moveStock(tx, { batchId: batch.id, medicineId: med.id, type: "PURCHASE", quantity: units, refId: purchase.id, userId });
      await tx.medicine.update({ where: { id: med.id }, data: { salePrice: l.salePrice } });
    }

    await addLedger(tx, { supplierId: data.supplierId, type: "PURCHASE", amount: total, refId: purchase.id, note: `Purchase #${purchase.number}${data.invoiceNo ? ` (bill ${data.invoiceNo})` : ""}`, userId });
    const paid = Math.min(data.paid, total);
    if (paid > 0) {
      await addLedger(tx, { supplierId: data.supplierId, type: "SUPPLIER_PAYMENT", amount: -paid, refId: purchase.id, note: `Paid with purchase #${purchase.number}`, userId });
    }
    return purchase;
  }, { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// Sales (POS)
// ---------------------------------------------------------------------------

export const saleSchema = z.object({
  customerId: z.string().optional().nullable(),
  paymentMethod: z.enum(["CASH", "CARD", "ONLINE", "CREDIT"]).default("CASH"),
  discount: z.coerce.number().min(0).default(0),
  paid: z.coerce.number().min(0).default(0),
  patientName: z.string().optional().nullable(),
  doctorName: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        medicineId: z.string().min(1),
        quantity: z.coerce.number().int().positive(), // base units
        discount: z.coerce.number().min(0).default(0), // line discount (Rs)
      }),
    )
    .min(1, "Cart is empty"),
});

export type SaleInput = z.infer<typeof saleSchema>;

export async function createSale(input: SaleInput, userId: string) {
  const data = saleSchema.parse(input);
  const today = dateOnly(todayPK());

  return db.$transaction(async (tx) => {
    const medIds = [...new Set(data.items.map((i) => i.medicineId))];
    const meds = await tx.medicine.findMany({
      where: { id: { in: medIds } },
      include: { batches: { where: { quantity: { gt: 0 }, expiryDate: { gt: today } } } },
    });
    const medMap = new Map(meds.map((m) => [m.id, m]));

    // Merge duplicate cart rows of the same medicine
    const merged = new Map<string, { quantity: number; discount: number }>();
    for (const it of data.items) {
      const cur = merged.get(it.medicineId) ?? { quantity: 0, discount: 0 };
      merged.set(it.medicineId, { quantity: cur.quantity + it.quantity, discount: cur.discount + it.discount });
    }

    type Line = { medicineId: string; batchId: string; quantity: number; unitPrice: number; unitCost: number; discount: number; lineTotal: number };
    const lines: Line[] = [];

    for (const [medicineId, it] of merged) {
      const med = medMap.get(medicineId);
      if (!med) throw new Error("Medicine not found");
      if (!med.allowLooseSale && it.quantity % med.unitsPerPack !== 0) {
        throw new Error(`${med.name} can only be sold in full ${med.packName}s`);
      }
      // Controlled drugs must be traceable (DRAP register): patient + prescribing doctor
      if (med.isControlled && (!data.patientName?.trim() || !data.doctorName?.trim())) {
        throw new Error(`${med.name} is a controlled drug — enter patient and doctor name`);
      }
      const { allocations, shortBy } = allocateFEFO(med.batches, it.quantity);
      if (shortBy > 0) {
        const available = it.quantity - shortBy;
        throw new Error(`Not enough stock for ${med.name}. Available: ${available} ${med.unitName}(s)`);
      }
      // Spread the line discount across allocations proportionally.
      const gross = allocations.map((a) => round2((num(a.batch.salePrice) / med.unitsPerPack) * a.quantity));
      const grossSum = gross.reduce((s, g) => s + g, 0);
      if (it.discount > grossSum) throw new Error(`Discount on ${med.name} is more than its price`);
      let discLeft = it.discount;
      allocations.forEach((a, i) => {
        const d = i === allocations.length - 1 ? round2(discLeft) : round2(grossSum ? (it.discount * gross[i]) / grossSum : 0);
        discLeft -= d;
        lines.push({
          medicineId,
          batchId: a.batch.id,
          quantity: a.quantity,
          unitPrice: num(a.batch.salePrice) / med.unitsPerPack,
          unitCost: num(a.batch.costPrice) / med.unitsPerPack,
          discount: d,
          lineTotal: round2(gross[i] - d),
        });
      });
    }

    const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    if (data.discount > subtotal) throw new Error("Discount is more than the bill");
    const total = round2(subtotal - data.discount);
    const costTotal = round2(lines.reduce((s, l) => s + l.unitCost * l.quantity, 0));

    const method = data.paymentMethod as PaymentMethod;
    let paid = data.paid;
    if (method !== "CASH") paid = Math.min(paid, total); // no "change" for card/online
    const change = round2(Math.max(paid - total, 0));
    const outstanding = round2(Math.max(total - paid, 0));

    if (outstanding > 0) {
      if (!data.customerId) throw new Error("Select a customer for credit (udhaar) sale");
      const c = await tx.customer.findUniqueOrThrow({ where: { id: data.customerId } });
      const limit = num(c.creditLimit);
      if (limit > 0 && num(c.balance) + outstanding > limit) {
        throw new Error(`Credit limit exceeded for ${c.name}. Limit ${limit}, current due ${num(c.balance)}`);
      }
    }

    const sale = await tx.sale.create({
      data: {
        customerId: data.customerId || null, userId, subtotal, discount: data.discount, total, costTotal,
        paid: round2(paid), change, paymentMethod: outstanding > 0 ? "CREDIT" : method,
        patientName: data.patientName || null, doctorName: data.doctorName || null, note: data.note || null,
        items: { create: lines.map((l) => ({ ...l, unitPrice: l.unitPrice, unitCost: l.unitCost })) },
      },
    });

    for (const l of lines) {
      await moveStock(tx, { batchId: l.batchId, medicineId: l.medicineId, type: "SALE", quantity: -l.quantity, refId: sale.id, userId });
    }
    if (outstanding > 0 && data.customerId) {
      await addLedger(tx, { customerId: data.customerId, type: "CREDIT_SALE", amount: outstanding, refId: sale.id, note: `Sale #${sale.number}`, userId });
    }
    return sale;
  }, { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// Sale return
// ---------------------------------------------------------------------------

export const saleReturnSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().optional().nullable(),
  items: z.array(z.object({ saleItemId: z.string(), quantity: z.coerce.number().int().min(0) })),
});

export async function createSaleReturn(input: z.infer<typeof saleReturnSchema>, userId: string) {
  const data = saleReturnSchema.parse(input);
  const wanted = data.items.filter((i) => i.quantity > 0);
  if (!wanted.length) throw new Error("Enter quantity to return");

  return db.$transaction(async (tx) => {
    const sale = await tx.sale.findUniqueOrThrow({ where: { id: data.saleId }, include: { items: true } });
    const itemMap = new Map(sale.items.map((i) => [i.id, i]));
    let total = 0;
    const rows: { saleItemId: string; quantity: number; amount: number }[] = [];

    for (const w of wanted) {
      const si = itemMap.get(w.saleItemId);
      if (!si) throw new Error("Item not in this sale");
      if (w.quantity > si.quantity - si.returnedQty) throw new Error("Return quantity is more than sold quantity");
      let amount = round2((num(si.lineTotal) * w.quantity) / si.quantity);
      // Bill-level discount is shared across lines
      const sub = num(sale.subtotal);
      if (sub > 0) amount = round2(amount * (num(sale.total) / sub));
      total += amount;
      rows.push({ saleItemId: si.id, quantity: w.quantity, amount });
      await tx.saleItem.update({ where: { id: si.id }, data: { returnedQty: { increment: w.quantity } } });
    }
    total = round2(total);

    const ret = await tx.saleReturn.create({
      data: { saleId: sale.id, userId, total, reason: data.reason || null, items: { create: rows } },
    });
    for (const r of rows) {
      const si = itemMap.get(r.saleItemId)!;
      await moveStock(tx, { batchId: si.batchId, medicineId: si.medicineId, type: "SALE_RETURN", quantity: r.quantity, refId: ret.id, userId });
    }

    // Credit sale: reduce what the customer owes (up to their balance); rest is cash refund.
    if (sale.customerId) {
      const c = await tx.customer.findUniqueOrThrow({ where: { id: sale.customerId } });
      const reduce = Math.min(total, Math.max(num(c.balance), 0));
      if (reduce > 0) {
        await addLedger(tx, { customerId: sale.customerId, type: "SALE_RETURN", amount: -reduce, refId: ret.id, note: `Return on sale #${sale.number}`, userId });
      }
    }
    return ret;
  }, { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// Purchase return (back to supplier)
// ---------------------------------------------------------------------------

export const purchaseReturnSchema = z.object({
  supplierId: z.string().min(1, "Select a supplier"),
  purchaseId: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  items: z
    .array(z.object({ batchId: z.string(), quantity: z.coerce.number().int().positive(), amount: z.coerce.number().min(0) }))
    .min(1, "Add at least one item"),
});

export async function createPurchaseReturn(input: z.infer<typeof purchaseReturnSchema>, userId: string) {
  const data = purchaseReturnSchema.parse(input);
  return db.$transaction(async (tx) => {
    const total = round2(data.items.reduce((s, i) => s + i.amount, 0));
    const ret = await tx.purchaseReturn.create({
      data: {
        supplierId: data.supplierId, purchaseId: data.purchaseId || null, userId, total, reason: data.reason || null,
        items: { create: data.items.map((i) => ({ batchId: i.batchId, quantity: i.quantity, amount: round2(i.amount) })) },
      },
    });
    for (const i of data.items) {
      const b = await tx.batch.findUniqueOrThrow({ where: { id: i.batchId } });
      await moveStock(tx, { batchId: b.id, medicineId: b.medicineId, type: "PURCHASE_RETURN", quantity: -i.quantity, refId: ret.id, userId });
    }
    await addLedger(tx, { supplierId: data.supplierId, type: "PURCHASE_RETURN", amount: -total, refId: ret.id, note: `Purchase return #${ret.number}`, userId });
    return ret;
  }, { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// Stock adjustment / opening stock
// ---------------------------------------------------------------------------

export async function adjustStock(
  input: { batchId: string; quantity: number; type: "ADJUSTMENT" | "EXPIRED"; note?: string },
  userId: string,
) {
  if (!Number.isInteger(input.quantity) || input.quantity === 0) throw new Error("Enter a non-zero quantity");
  return db.$transaction(async (tx) => {
    const b = await tx.batch.findUniqueOrThrow({ where: { id: input.batchId } });
    await moveStock(tx, { batchId: b.id, medicineId: b.medicineId, type: input.type, quantity: input.quantity, note: input.note, userId });
  });
}

export const openingStockSchema = z.object({
  medicineId: z.string().min(1),
  batchNo: z.string().trim().min(1, "Batch no. is required"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date is required"),
  costPrice: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0),
  packs: z.coerce.number().int().min(0).default(0),
  units: z.coerce.number().int().min(0).default(0),
});

export async function addOpeningStock(input: z.infer<typeof openingStockSchema>, userId: string) {
  const data = openingStockSchema.parse(input);
  return db.$transaction(async (tx) => {
    const med = await tx.medicine.findUniqueOrThrow({ where: { id: data.medicineId } });
    const qty = data.packs * med.unitsPerPack + data.units;
    if (qty <= 0) throw new Error("Enter quantity");
    const costPrice = await blendedCost(tx, med.id, data.batchNo, qty, data.costPrice);
    const batch = await tx.batch.upsert({
      where: { medicineId_batchNo: { medicineId: med.id, batchNo: data.batchNo } },
      create: { medicineId: med.id, batchNo: data.batchNo, expiryDate: dateOnly(data.expiryDate), costPrice, salePrice: data.salePrice },
      update: { expiryDate: dateOnly(data.expiryDate), costPrice, salePrice: data.salePrice },
    });
    await moveStock(tx, { batchId: batch.id, medicineId: med.id, type: "OPENING", quantity: qty, note: "Opening stock", userId });
    await tx.medicine.update({ where: { id: med.id }, data: { salePrice: data.salePrice } });
  });
}
