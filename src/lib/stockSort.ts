/**
 * Stable sort that pushes sold-out items to the end of a product list.
 *
 * Order priority:
 *   in_stock   → 0
 *   low_stock  → 1
 *   out_of_stock → 2
 *
 * Within each bucket, the original relative order is preserved (stable),
 * so any upstream sort (newest first, featured admin order, daily-shuffle,
 * category order, etc.) stays intact inside the bucket.
 */
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

const PRIORITY: Record<StockStatus, number> = {
  in_stock: 0,
  low_stock: 1,
  out_of_stock: 2,
};

export function sortByStockStatus<T extends { stockStatus?: StockStatus | string | null }>(
  items: T[]
): T[] {
  return items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const ap = PRIORITY[(a.item.stockStatus as StockStatus) ?? "in_stock"] ?? 0;
      const bp = PRIORITY[(b.item.stockStatus as StockStatus) ?? "in_stock"] ?? 0;
      if (ap !== bp) return ap - bp;
      return a.idx - b.idx; // stable
    })
    .map(({ item }) => item);
}
