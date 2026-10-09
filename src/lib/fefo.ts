// First-expiry-first-out allocation. Shared by the server (real sale) and POS (preview).
export type BatchLite = { id: string; quantity: number; salePrice: unknown; costPrice?: unknown; expiryDate: Date | string };

export function allocateFEFO<B extends BatchLite>(batches: B[], qty: number) {
  const sorted = [...batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  const out: { batch: B; quantity: number }[] = [];
  let left = qty;
  for (const b of sorted) {
    if (left <= 0) break;
    if (b.quantity <= 0) continue;
    const take = Math.min(b.quantity, left);
    out.push({ batch: b, quantity: take });
    left -= take;
  }
  return { allocations: out, shortBy: left };
}
