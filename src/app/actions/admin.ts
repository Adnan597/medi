"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { errMsg, str, type ActionResult } from "@/lib/utils";
import { DEFAULT_BRAND_COLOR, isHexColor } from "@/lib/brand";
import { readLogo } from "@/lib/logo";

export async function saveSettings(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser("settings");
  const storeName = str(fd, "storeName");
  if (!storeName) return { ok: false, error: "Pharmacy name is required" };
  const color = str(fd, "brandColor") ?? "";
  const nearExpiryDays = Math.max(1, Math.floor(Number(fd.get("nearExpiryDays") || 90)));

  const logo = await readLogo(fd.get("logo"));
  if (logo && "error" in logo) return { ok: false, error: logo.error };
  const logoData = logo
    ? { logo: logo.bytes, logoMime: logo.mime, logoUpdatedAt: new Date() }
    : fd.get("removeLogo") === "on"
      ? { logo: null, logoMime: null, logoUpdatedAt: null }
      : {};

  const data = {
    storeName,
    tagline: str(fd, "tagline") ?? "",
    address: str(fd, "address") ?? "",
    phone: str(fd, "phone") ?? "",
    email: str(fd, "email") ?? "",
    licenseNo: str(fd, "licenseNo") ?? "",
    ntn: str(fd, "ntn") ?? "",
    brandColor: isHexColor(color) ? color : DEFAULT_BRAND_COLOR,
    showLogoOnReceipt: fd.get("showLogoOnReceipt") === "on",
    receiptFooter: str(fd, "receiptFooter") ?? "",
    nearExpiryDays,
    ...logoData,
  };
  await db.storeSetting.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved" };
}

export async function saveUser(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const me = await requireUser("settings");
  const id = str(fd, "id");
  const name = str(fd, "name");
  const username = str(fd, "username")?.toLowerCase();
  const role = String(fd.get("role")) as "ADMIN" | "PHARMACIST" | "CASHIER";
  const password = String(fd.get("password") ?? "");
  const active = fd.get("active") === "on";
  if (!name || !username) return { ok: false, error: "Name and username are required" };
  if (!["ADMIN", "PHARMACIST", "CASHIER"].includes(role)) return { ok: false, error: "Invalid role" };
  if (!id && password.length < 6) return { ok: false, error: "Password must be at least 6 characters" };
  if (id && password && password.length < 6) return { ok: false, error: "Password must be at least 6 characters" };
  if (id === me.id && (role !== "ADMIN" || !active)) return { ok: false, error: "You can't remove your own admin access" };

  try {
    if (id) {
      await db.user.update({
        where: { id },
        data: { name, username, role, active, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
      });
    } else {
      await db.user.create({ data: { name, username, role, passwordHash: await bcrypt.hash(password, 10) } });
    }
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidatePath("/settings");
  return { ok: true, message: id ? "User updated" : "User created" };
}

export async function saveExpense(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser("expenses");
  const amount = Number(fd.get("amount") || 0);
  const category = str(fd, "category");
  const date = str(fd, "date");
  if (!(amount > 0) || !category) return { ok: false, error: "Enter category and amount" };
  await db.expense.create({
    data: { amount, category, note: str(fd, "note"), userId: user.id, date: date ? new Date(`${date}T12:00:00+05:00`) : new Date() },
  });
  revalidatePath("/expenses");
  return { ok: true, message: "Expense added" };
}

export async function deleteExpense(fd: FormData) {
  await requireUser("expenses");
  await db.expense.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/expenses");
}
