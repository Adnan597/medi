// Shared formatting helpers (safe for server and client).
// The store runs in Pakistan: all "day" logic uses Asia/Karachi (UTC+5, no DST).

export const TZ = "Asia/Karachi";
const PK_OFFSET = "+05:00";

type Numeric = number | string | { toString(): string } | null | undefined;

/** Prisma Decimal / string / number -> number */
export function num(v: Numeric): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const wholeFmt = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const paisaFmt = new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Rs 1,200 for whole rupees, Rs 3,358.40 when there are paisa. */
export function money(v: Numeric) {
  const n = round2(num(v));
  return `Rs ${(Number.isInteger(n) ? wholeFmt : paisaFmt).format(n)}`;
}

export function fmtDate(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export function fmtDateTime(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(d));
}

/** Expiry dates are stored as plain dates (UTC midnight) — format without TZ shift. */
export function fmtExpiry(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", year: "numeric" }).format(new Date(d));
}

/** Today's date in Pakistan as YYYY-MM-DD */
export function todayPK() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function toPKDateString(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** [start, end] instants covering the given PK calendar days (inclusive). */
export function pkRange(from: string, to: string = from) {
  return {
    gte: new Date(`${from}T00:00:00.000${PK_OFFSET}`),
    lte: new Date(`${to}T23:59:59.999${PK_OFFSET}`),
  };
}

/** A PK calendar date as a UTC-midnight Date — matches @db.Date columns. */
export function dateOnly(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function addDays(ymd: string, days: number) {
  const d = dateOnly(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function invoiceNo(n: number, prefix = "INV") {
  return `${prefix}-${String(n).padStart(6, "0")}`;
}

/** 25 tablets with 10/strip -> "2 Strip + 5 Tablet" */
export function fmtQty(units: number, unitsPerPack: number, packName: string, unitName: string) {
  if (unitsPerPack <= 1) return `${units} ${unitName}`;
  const sign = units < 0 ? "-" : "";
  const abs = Math.abs(units);
  const packs = Math.floor(abs / unitsPerPack);
  const rest = abs % unitsPerPack;
  const parts: string[] = [];
  if (packs) parts.push(`${packs} ${packName}`);
  if (rest || !packs) parts.push(`${rest} ${unitName}`);
  return sign + parts.join(" + ");
}

export function daysUntil(expiry: Date | string) {
  const today = dateOnly(todayPK()).getTime();
  return Math.round((new Date(expiry).getTime() - today) / 86_400_000);
}
