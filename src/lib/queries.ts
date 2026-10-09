import "server-only";
import { db } from "./db";
import { addDays, dateOnly, num, todayPK } from "./format";

/** Sellable (non-expired) stock per medicine, in base units. */
export async function sellableStockMap() {
  const today = dateOnly(todayPK());
  const rows = await db.batch.groupBy({
    by: ["medicineId"],
    where: { expiryDate: { gt: today }, quantity: { gt: 0 } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.medicineId, r._sum.quantity ?? 0]));
}

export async function lowStockMedicines() {
  const [meds, stock] = await Promise.all([
    db.medicine.findMany({
      where: { active: true, reorderLevel: { gt: 0 } },
      select: { id: true, name: true, strength: true, reorderLevel: true, unitsPerPack: true, packName: true, unitName: true },
      orderBy: { name: "asc" },
    }),
    sellableStockMap(),
  ]);
  return meds
    .map((m) => ({ ...m, stock: stock.get(m.id) ?? 0 }))
    .filter((m) => m.stock <= m.reorderLevel);
}

export async function expiryWindow(days: number) {
  const today = todayPK();
  return { today: dateOnly(today), until: dateOnly(addDays(today, days)) };
}

/**
 * Sales figures for a date range, net of returns — the single source used by
 * the dashboard and reports so both always show the same numbers.
 */
export async function salesSummary(range: { gte: Date; lte: Date }) {
  const [sales, returns, returnItems, expenses] = await Promise.all([
    db.sale.aggregate({ where: { date: range }, _sum: { total: true, costTotal: true, discount: true }, _count: true }),
    db.saleReturn.aggregate({ where: { createdAt: range }, _sum: { total: true } }),
    db.saleReturnItem.findMany({ where: { return: { createdAt: range } }, select: { quantity: true, saleItem: { select: { unitCost: true } } } }),
    db.expense.aggregate({ where: { date: range }, _sum: { amount: true } }),
  ]);
  const returnedCost = returnItems.reduce((s, r) => s + num(r.saleItem.unitCost) * r.quantity, 0);
  const grossSales = num(sales._sum.total);
  const returnTotal = num(returns._sum.total);
  const netSales = grossSales - returnTotal;
  const cogs = num(sales._sum.costTotal) - returnedCost;
  const grossProfit = netSales - cogs;
  const expenseTotal = num(expenses._sum.amount);
  return {
    invoices: sales._count,
    grossSales,
    returnTotal,
    netSales,
    cogs,
    grossProfit,
    discount: num(sales._sum.discount),
    expenseTotal,
    netProfit: grossProfit - expenseTotal,
  };
}
