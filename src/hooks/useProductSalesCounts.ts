import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductSoldLookup {
  byHandle: Map<string, number>;
  byId: Map<string, number>;
}

/**
 * Fetches per-product sold counts from the `weekly_best_sellers` view and
 * returns lookup maps keyed by product handle and product id.
 *
 * This is reusable across listings (shop, categories, best sellers, etc.)
 * so any product card can show "X sold" when the data is available.
 *
 * Falls back gracefully (empty maps) if Supabase errors. Cached 5 min.
 */
export function useProductSalesCounts() {
  return useQuery({
    queryKey: ['product-sales-counts'],
    queryFn: async (): Promise<ProductSoldLookup> => {
      const { data, error } = await supabase
        .from('weekly_best_sellers')
        .select('product_id, product_handle, total_sold');

      const byHandle = new Map<string, number>();
      const byId = new Map<string, number>();

      if (error) {
        console.error('[sales-counts] error', error);
        return { byHandle, byId };
      }

      for (const row of data ?? []) {
        const sold = row.total_sold ?? 0;
        if (row.product_handle) {
          // Sum in case the view returns multiple rows per handle (variants).
          byHandle.set(row.product_handle, (byHandle.get(row.product_handle) ?? 0) + sold);
        }
        if (row.product_id) {
          byId.set(row.product_id, (byId.get(row.product_id) ?? 0) + sold);
        }
      }

      return { byHandle, byId };
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Resolve sold count for a product given its handle/id. */
export function lookupSoldCount(
  lookup: ProductSoldLookup | undefined,
  product: { handle?: string; id?: string }
): number | undefined {
  if (!lookup) return undefined;
  if (product.handle && lookup.byHandle.has(product.handle)) {
    return lookup.byHandle.get(product.handle);
  }
  if (product.id && lookup.byId.has(product.id)) {
    return lookup.byId.get(product.id);
  }
  return undefined;
}
