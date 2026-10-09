import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession, type Role, type SessionPayload } from "./session";

export type { Role };

// Who can open each section. ADMIN can do everything.
export const PERMISSIONS = {
  pos: ["ADMIN", "PHARMACIST", "CASHIER"],
  sales: ["ADMIN", "PHARMACIST", "CASHIER"],
  customers: ["ADMIN", "PHARMACIST", "CASHIER"],
  medicines: ["ADMIN", "PHARMACIST"],
  purchases: ["ADMIN", "PHARMACIST"],
  stock: ["ADMIN", "PHARMACIST"],
  suppliers: ["ADMIN", "PHARMACIST"],
  expenses: ["ADMIN"],
  reports: ["ADMIN"],
  settings: ["ADMIN"],
  viewCost: ["ADMIN", "PHARMACIST"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, perm: Permission) {
  return (PERMISSIONS[perm] as readonly Role[]).includes(role);
}

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Current user, re-checked against the DB (so deactivated users are locked out). */
export const getUser = cache(async () => {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, username: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return user;
});

/** Use at the top of pages and server actions. Redirects if not allowed. */
export async function requireUser(perm?: Permission) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (perm && !can(user.role, perm)) redirect("/?denied=1");
  return user;
}
