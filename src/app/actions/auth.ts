"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/utils";

export async function login(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const username = String(fd.get("username") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!username || !password) return { ok: false, error: "Enter username and password" };

  const user = await db.user.findUnique({ where: { username } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { ok: false, error: "Invalid username or password" };
  }
  await createSession({ userId: user.id, name: user.name, role: user.role });
  redirect(user.role === "CASHIER" ? "/pos" : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function changePassword(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 6) return { ok: false, error: "New password must be at least 6 characters" };
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return { ok: false, error: "Current password is wrong" };
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: true, message: "Password changed" };
}
