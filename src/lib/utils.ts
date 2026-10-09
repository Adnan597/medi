import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  // twMerge: a caller's "w-16" overrides a component's default "w-full"
  return twMerge(clsx(inputs));
}

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string };

/** Read an optional trimmed string from FormData ("" -> null). */
export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function errMsg(e: unknown) {
  if (e instanceof Error) {
    // Prisma unique constraint
    if ("code" in e && (e as { code?: string }).code === "P2002") return "This record already exists (duplicate value).";
    return e.message;
  }
  return "Something went wrong";
}
