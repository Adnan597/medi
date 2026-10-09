import Link from "next/link";

/** Simple prev/next pager that keeps the other query params. */
export function Pager({ page, hasMore, params }: { page: number; hasMore: boolean; params: Record<string, string | string[] | undefined> }) {
  if (page <= 1 && !hasMore) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v && k !== "page") q.set(k, v);
    q.set("page", String(p));
    return `?${q.toString()}`;
  };
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      {page > 1 && <Link className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50" href={href(page - 1)}>← Previous</Link>}
      <span className="text-slate-500">Page {page}</span>
      {hasMore && <Link className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50" href={href(page + 1)}>Next →</Link>}
    </div>
  );
}

export function pageOf(sp: Record<string, string | string[] | undefined>) {
  const p = Number(typeof sp.page === "string" ? sp.page : 1);
  return Number.isInteger(p) && p > 0 ? p : 1;
}
