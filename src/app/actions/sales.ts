"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSaleReturn } from "@/lib/services";
import { errMsg, type ActionResult } from "@/lib/utils";
import { money } from "@/lib/format";

export async function saleReturnAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser("sales");
  const saleId = String(fd.get("saleId"));
  const items: { saleItemId: string; quantity: number }[] = [];
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("qty_")) items.push({ saleItemId: k.slice(4), quantity: Number(v) || 0 });
  }
  try {
    const ret = await createSaleReturn({ saleId, items, reason: String(fd.get("reason") ?? "") || null }, user.id);
    revalidatePath(`/sales/${saleId}`);
    return { ok: true, message: `Return saved. Refund / credit: ${money(ret.total)}` };
  } catch (e) {
    return { ok: false, error: e instanceof z.ZodError ? e.issues[0].message : errMsg(e) };
  }
}
