import "server-only";
import { LOGO_MAX_BYTES, LOGO_TYPES } from "./brand";

/** Validate an uploaded logo from FormData. Returns null when no file was chosen. */
export async function readLogo(v: FormDataEntryValue | null): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string } | { error: string } | null> {
  if (!v || typeof v === "string" || v.size === 0) return null;
  if (!LOGO_TYPES.includes(v.type)) return { error: "Logo must be a PNG, JPG or WEBP image" };
  if (v.size > LOGO_MAX_BYTES) return { error: `Logo is too large (max ${LOGO_MAX_BYTES / 1024} KB)` };
  const bytes = new Uint8Array(await v.arrayBuffer());
  // Check the file's magic bytes too, not just the browser-supplied type
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!isPng && !isJpg && !isWebp) return { error: "That file doesn't look like a valid image" };
  return { bytes, mime: isPng ? "image/png" : isJpg ? "image/jpeg" : "image/webp" };
}
