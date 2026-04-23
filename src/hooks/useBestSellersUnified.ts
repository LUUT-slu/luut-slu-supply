import { useMemo } from 'react';
import { useShopifyBestSellers } from './useShopifyBestSellers';
import { useBestSellers, BestSellerProduct } from './useBestSellers';
import { UnifiedProduct } from '@/lib/products';
import { sortByStockStatus } from '@/lib/stockSort';

export type BestSellersSource = 'shopify' | 'local' | 'none';

export interface BestSellerEntry {
  product: UnifiedProduct;
  /** Units sold, when available from local sales tracking. */
  totalSold?: number;
}

export interface UseBestSellersUnifiedResult {
  /** Backwards-compatible: just the product objects. */
  products: UnifiedProduct[];
  /** Same list with optional sold counts attached, in rank order. */
  entries: BestSellerEntry[];
  isLoading: boolean;
  source: BestSellersSource;
}

/**
 * Map a row from the Supabase `weekly_best_sellers` view to a minimal
 * UnifiedProduct shape so the same UI component can render either source.
 */
function localToUnified(row: BestSellerProduct): UnifiedProduct {
  const isShopify = row.product_id.startsWith('gid://');
  const handle = isShopify ? row.product_handle : `lovable-${row.product_id}`;
  const amount = String(row.price ?? 0);
  const currency = row.currency_code || 'XCD';

  return {
    id: row.product_id,
    source: isShopify ? 'shopify' : 'lovable',
    title: row.product_title,
    description: '',
    handle,
    vendor: 'Luut SLU',
    category: null,
    stockStatus: 'in_stock',
    price: { amount, currencyCode: currency },
    images: row.product_image_url
      ? [{ url: row.product_image_url, altText: row.product_title }]
      : [],
    variants: [
      {
        id: `bestseller-variant-${row.product_id}`,
        title: 'Default',
        price: { amount, currencyCode: currency },
        availableForSale: true,
        selectedOptions: [],
      },
    ],
  };
}

/**
 * Unified best sellers hook.
 *
 * Primary ranking: Shopify Storefront API `sortKey: BEST_SELLING` (real-time,
 * store-wide sales-performance ranking from Shopify itself).
 *
 * Sold counts: merged in from the local Supabase `weekly_best_sellers` view
 * (which tracks units sold via `product_sales`). Shopify's Storefront API
 * does not expose unit counts, so any product without a local sales record
 * simply has no `totalSold` value (UI shows the rank instead).
 *
 * Fallback: if Shopify returns empty/errors, fall back to the local view so
 * the section still renders.
 */
export function useBestSellersUnified(limit: number = 12): UseBestSellersUnifiedResult {
  const shopifyQuery = useShopifyBestSellers(limit);
  const shopifyProducts = shopifyQuery.data ?? [];

  // Always fetch local sales so we can attach sold counts to Shopify rankings
  const localQuery = useBestSellers();
  const localRows = localQuery.data ?? [];

  return useMemo<UseBestSellersUnifiedResult>(() => {
    // Build a sold-count lookup from the local view, keyed by both handle and id
    const soldByHandle = new Map<string, number>();
    const soldById = new Map<string, number>();
    for (const row of localRows) {
      if (row.product_handle) soldByHandle.set(row.product_handle, row.total_sold ?? 0);
      if (row.product_id) soldById.set(row.product_id, row.total_sold ?? 0);
    }

    if (shopifyProducts.length > 0) {
      const products = shopifyProducts.slice(0, limit);
      const entries: BestSellerEntry[] = products.map((product) => {
        const sold =
          soldByHandle.get(product.handle) ??
          soldById.get(product.id);
        return { product, totalSold: sold };
      });
      return {
        products,
        entries,
        isLoading: false,
        source: 'shopify',
      };
    }

    if (shopifyQuery.isLoading) {
      return { products: [], entries: [], isLoading: true, source: 'none' };
    }

    if (localQuery.isLoading) {
      return { products: [], entries: [], isLoading: true, source: 'none' };
    }

    if (localRows.length > 0) {
      const sliced = localRows.slice(0, limit);
      const paired = sliced.map((row) => ({
        product: localToUnified(row),
        totalSold: row.total_sold ?? undefined,
      }));
      const sortedProducts = sortByStockStatus(paired.map((p) => p.product));
      const byId = new Map(paired.map((p) => [p.product.id, p.totalSold]));
      const entries: BestSellerEntry[] = sortedProducts.map((product) => ({
        product,
        totalSold: byId.get(product.id),
      }));
      return {
        products: sortedProducts,
        entries,
        isLoading: false,
        source: 'local',
      };
    }

    return { products: [], entries: [], isLoading: false, source: 'none' };
  }, [shopifyProducts, shopifyQuery.isLoading, localRows, localQuery.isLoading, limit]);
}
