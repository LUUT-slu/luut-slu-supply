import { useQuery } from '@tanstack/react-query';
import { UnifiedProduct, fetchHybridProducts } from '@/lib/products';

interface UseHybridProductsOptions {
  categorySlug?: string;  // URL slug like "beanies-tams" OR full Shopify collection handle
  shopifyQuery?: string;  // Override Shopify query
  limit?: number;
  mainCategory?: string;
  subCategory?: string;
}

export function useHybridProducts(options: UseHybridProductsOptions = {}) {
  const { data: products = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: [
      'hybridProducts',
      options.categorySlug,
      options.shopifyQuery,
      options.limit,
      options.mainCategory,
      options.subCategory,
    ],
    queryFn: () => fetchHybridProducts({
      categorySlug: options.categorySlug,
      shopifyQuery: options.shopifyQuery,
      limit: options.limit,
      mainCategory: options.mainCategory,
      subCategory: options.subCategory,
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes — avoid redundant Shopify calls
  });

  const error = queryError ? 'Failed to load products' : null;

  return { products, loading, error };
}
