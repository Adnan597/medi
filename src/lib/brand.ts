// Software (vendor) branding — same for every pharmacy that runs this build.
// Pharmacy branding (name, logo, colour…) lives in the database: see settings.ts.

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Pharmacy Manager";
export const VENDOR_NAME = process.env.NEXT_PUBLIC_VENDOR_NAME || "";
export const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "";

/** "Powered by X · 0300-…" — empty string when no vendor is configured. */
export function poweredBy() {
  const who = VENDOR_NAME || APP_NAME;
  return SUPPORT_PHONE ? `Powered by ${who} · ${SUPPORT_PHONE}` : `Powered by ${who}`;
}

export const DEFAULT_BRAND_COLOR = "#059669";

export const BRAND_PRESETS = [
  { name: "Emerald", value: "#059669" },
  { name: "Teal", value: "#0d9488" },
  { name: "Sky", value: "#0284c7" },
  { name: "Blue", value: "#2563eb" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Slate", value: "#334155" },
];

export function isHexColor(v: string) {
  return /^#[0-9a-f]{6}$/i.test(v);
}

export const LOGO_MAX_BYTES = 300 * 1024;
// SVG is excluded on purpose: it can carry scripts and we serve it from our own origin.
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
