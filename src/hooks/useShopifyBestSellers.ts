import { useQuery } from '@tanstack/react-query';
import { fetchProducts } from '@/lib/shopify';
import { shopifyToUnified, UnifiedProduct } from '@/lib/products';
import { sortByStockStatus } from '@/lib/stockSort';

/**
 * Fetches best-selling products directly from Shopify using the
 * Storefront API's official `sortKey: BEST_SELLING` signal.
 *
 * This is Shopify's native best-seller ranking — the same one that powers
 * the "Best selling" sort in admin and themes. It updates automatically
 * as orders are placed in Shopify, so no manual curation is needed.
 *
 * Returns an empty array on error/timeout (Shopify request has a 10s cap),
 * letting callers fall back to a secondary source gracefully.
 */
export function useShopifyBestSellers(limit: number = 12) {
  return useQuery({
    queryKey: ['shopify-best-sellers', limit],
    queryFn: async (): Promise<UnifiedProduct[]> => {
      try {
        const products = await fetchProducts(
          limit,
          'available_for_sale:true',
          'BEST_SELLING',
          false,
        );
        if (!products || products.length === 0) return [];
        const unified = products.map(shopifyToUnified);
        // Sold-out items (rare here since we filter by available_for_sale) go last
        return sortByStockStatus(unified);
      } catch (err) {
        console.warn('[shopify-best-sellers] fetch failed:', (err as Error)?.message);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
