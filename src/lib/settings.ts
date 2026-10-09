import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { db } from "./db";
import { DEFAULT_BRAND_COLOR, isHexColor } from "./brand";

/**
 * The pharmacy's settings & branding (one row per database). Excludes the logo
 * bytes — those are served by /api/logo. Always read at request time so a
 * change in Settings shows up immediately.
 */
export const getSettings = cache(async () => {
  await connection();
  const s =
    (await db.storeSetting.findUnique({ where: { id: 1 }, omit: { logo: true } })) ??
    (await db.storeSetting.create({ data: { id: 1 }, omit: { logo: true } }));
  return {
    ...s,
    brandColor: isHexColor(s.brandColor) ? s.brandColor : DEFAULT_BRAND_COLOR,
    // Versioned URL so browsers refetch after a new upload
    logoUrl: s.logoUpdatedAt && s.logoMime ? `/api/logo?v=${s.logoUpdatedAt.getTime()}` : null,
  };
});

export type Settings = Awaited<ReturnType<typeof getSettings>>;

/** True until the first admin account has been created on this database. */
export const needsSetup = cache(async () => {
  await connection();
  return (await db.user.count()) === 0;
});
