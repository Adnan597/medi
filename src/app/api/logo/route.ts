import { db } from "@/lib/db";

// Public on purpose: the login page and browser tab icon need the logo before sign-in.
export async function GET() {
  const s = await db.storeSetting.findUnique({ where: { id: 1 }, select: { logo: true, logoMime: true } });
  if (!s?.logo || !s.logoMime) return new Response("No logo", { status: 404 });
  return new Response(new Uint8Array(s.logo), {
    headers: {
      "Content-Type": s.logoMime,
      // URLs carry ?v=<updatedAt>, so a long cache is safe
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
