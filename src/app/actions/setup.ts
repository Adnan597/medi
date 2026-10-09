"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { isHexColor } from "@/lib/brand";
import { readLogo } from "@/lib/logo";
import { str, type ActionResult } from "@/lib/utils";

/** First-run setup: creates the store profile and the first admin. Works only on an empty database. */
export async function completeSetup(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const storeName = str(fd, "storeName");
  const adminName = str(fd, "adminName");
  const username = str(fd, "username")?.toLowerCase();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const color = str(fd, "brandColor") ?? "";

  if (!storeName) return { ok: false, error: "Pharmacy name is required" };
  if (!adminName || !username) return { ok: false, error: "Admin name and username are required" };
  if (!/^[a-z0-9._-]{3,}$/.test(username)) return { ok: false, error: "Username: at least 3 letters/numbers, no spaces" };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters" };
  if (password !== confirm) return { ok: false, error: "Passwords do not match" };

  const logo = await readLogo(fd.get("logo"));
  if (logo && "error" in logo) return { ok: false, error: logo.error };

  const passwordHash = await bcrypt.hash(password, 10);
  let userId: string;
  try {
    userId = await db.$transaction(async (tx) => {
      // Checked inside the transaction so setup can never run twice.
      if ((await tx.user.count()) > 0) throw new Error("ALREADY_SETUP");
      const branding = {
        storeName,
        tagline: str(fd, "tagline") ?? "",
        address: str(fd, "address") ?? "",
        phone: str(fd, "phone") ?? "",
        licenseNo: str(fd, "licenseNo") ?? "",
        brandColor: isHexColor(color) ? color : "#059669",
        setupCompletedAt: new Date(),
        ...(logo ? { logo: logo.bytes, logoMime: logo.mime, logoUpdatedAt: new Date() } : {}),
      };
      await tx.storeSetting.upsert({ where: { id: 1 }, create: { id: 1, ...branding }, update: branding });
      const u = await tx.user.create({ data: { name: adminName, username, role: "ADMIN", passwordHash } });
      return u.id;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_SETUP") redirect("/login");
    throw e;
  }

  await createSession({ userId, name: adminName, role: "ADMIN" });
  redirect("/");
}
