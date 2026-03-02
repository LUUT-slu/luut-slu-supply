import { useQuery } from '@tanstack/react-query';
import { UnifiedProduct, fetchHybridProducts } from '@/lib/products';

interface UseHybridProductsOptions {
  categorySlug?: string;  // URL slug like "beanies-tams"
  shopifyQuery?: string;  // Override Shopify query
  limit?: number;
}

export function useHybridProducts(options: UseHybridProductsOptions = {}) {
  const { data: products = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['hybridProducts', options.categorySlug, options.shopifyQuery, options.limit],
    queryFn: () => fetchHybridProducts({
      categorySlug: options.categorySlug,
      shopifyQuery: options.shopifyQuery,
      limit: options.limit,
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes — avoid redundant Shopify calls
  });

  const error = queryError ? 'Failed to load products' : null;

  return { products, loading, error };
}
