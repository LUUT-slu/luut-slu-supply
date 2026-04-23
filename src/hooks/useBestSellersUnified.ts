import { useMemo } from 'react';
import { useShopifyBestSellers } from './useShopifyBestSellers';
import { useBestSellers, BestSellerProduct } from './useBestSellers';
import { UnifiedProduct } from '@/lib/products';
import { sortByStockStatus } from '@/lib/stockSort';

export type BestSellersSource = 'shopify' | 'local' | 'none';

export interface UseBestSellersUnifiedResult {
  products: UnifiedProduct[];
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
 * Primary: Shopify Storefront API `sortKey: BEST_SELLING` (real-time, store-wide
 * sales-performance ranking from Shopify itself).
 * Fallback: Supabase `weekly_best_sellers` view (local sales tracking) if
 * Shopify returns empty/errors so the section never disappears unexpectedly.
 */
export function useBestSellersUnified(limit: number = 12): UseBestSellersUnifiedResult {
  const shopifyQuery = useShopifyBestSellers(limit);
  const shopifyProducts = shopifyQuery.data ?? [];
  const shopifyEmpty = !shopifyQuery.isLoading && shopifyProducts.length === 0;

  // Only run the local fallback when Shopify finished and returned nothing
  const localQuery = useBestSellers();
  const localEnabled = shopifyEmpty;

  return useMemo<UseBestSellersUnifiedResult>(() => {
    if (shopifyProducts.length > 0) {
      return {
        products: shopifyProducts.slice(0, limit),
        isLoading: false,
        source: 'shopify',
      };
    }

    if (shopifyQuery.isLoading) {
      return { products: [], isLoading: true, source: 'none' };
    }

    if (localEnabled && localQuery.isLoading) {
      return { products: [], isLoading: true, source: 'none' };
    }

    const localRows = localQuery.data ?? [];
    if (localRows.length > 0) {
      const mapped = sortByStockStatus(localRows.slice(0, limit).map(localToUnified));
      return { products: mapped, isLoading: false, source: 'local' };
    }

    return { products: [], isLoading: false, source: 'none' };
  }, [shopifyProducts, shopifyQuery.isLoading, localEnabled, localQuery.isLoading, localQuery.data, limit]);
}
