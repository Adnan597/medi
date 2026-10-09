"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addLedger } from "@/lib/services";
import { errMsg, str, type ActionResult } from "@/lib/utils";

export async function saveSupplier(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser("suppliers");
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Name is required" };
  const data = { name, phone: str(fd, "phone"), contactPerson: str(fd, "contactPerson"), address: str(fd, "address") };
  try {
    if (id) {
      await db.supplier.update({ where: { id }, data });
    } else {
      const opening = Number(fd.get("opening") || 0);
      await db.$transaction(async (tx) => {
        const s = await tx.supplier.create({ data });
        if (opening) await addLedger(tx, { supplierId: s.id, type: "OPENING", amount: opening, note: "Opening balance", userId: user.id });
      });
    }
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidatePath("/suppliers");
  if (id) revalidatePath(`/suppliers/${id}`);
  return { ok: true, message: id ? "Supplier updated" : "Supplier added" };
}

export async function saveCustomer(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser("customers");
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Name is required" };
  const data = { name, phone: str(fd, "phone"), address: str(fd, "address"), creditLimit: Number(fd.get("creditLimit") || 0) };
  try {
    if (id) {
      await db.customer.update({ where: { id }, data });
    } else {
      const opening = Number(fd.get("opening") || 0);
      await db.$transaction(async (tx) => {
        const c = await tx.customer.create({ data });
        if (opening) await addLedger(tx, { customerId: c.id, type: "OPENING", amount: opening, note: "Opening balance", userId: user.id });
      });
    }
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidatePath("/customers");
  if (id) revalidatePath(`/customers/${id}`);
  return { ok: true, message: id ? "Customer updated" : "Customer added" };
}

/** Payment to supplier (reduces what we owe) or received from customer (reduces what they owe). */
export async function recordPayment(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const party = fd.get("party") === "supplier" ? "supplier" : "customer";
  const user = await requireUser(party === "supplier" ? "suppliers" : "customers");
  const id = String(fd.get("id"));
  const amount = Number(fd.get("amount") || 0);
  const kind = fd.get("kind") === "adjust" ? "adjust" : "payment";
  const note = str(fd, "note") ?? undefined;
  if (!amount || (kind === "payment" && amount <= 0)) return { ok: false, error: "Enter a valid amount" };
  if (kind === "adjust" && user.role !== "ADMIN") return { ok: false, error: "Only admin can adjust balances" };

  try {
    await db.$transaction(async (tx) => {
      if (party === "supplier") {
        await addLedger(tx, {
          supplierId: id, userId: user.id, note,
          type: kind === "adjust" ? "ADJUSTMENT" : "SUPPLIER_PAYMENT",
          amount: kind === "adjust" ? amount : -amount,
        });
      } else {
        await addLedger(tx, {
          customerId: id, userId: user.id, note,
          type: kind === "adjust" ? "ADJUSTMENT" : "CUSTOMER_PAYMENT",
          amount: kind === "adjust" ? amount : -amount,
        });
      }
    });
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidatePath(`/${party}s/${id}`);
  revalidatePath(`/${party}s`);
  return { ok: true, message: kind === "adjust" ? "Balance adjusted" : "Payment recorded" };
}
