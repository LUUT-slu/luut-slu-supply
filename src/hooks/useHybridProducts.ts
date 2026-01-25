import { useState, useEffect } from 'react';
import { UnifiedProduct, fetchHybridProducts } from '@/lib/products';

interface UseHybridProductsOptions {
  category?: string;
  shopifyQuery?: string;
  limit?: number;
}

export function useHybridProducts(options: UseHybridProductsOptions = {}) {
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchHybridProducts(options);
        setProducts(data);
      } catch (err) {
        console.error('Failed to load products:', err);
        setError('Failed to load products');
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [options.category, options.shopifyQuery, options.limit]);

  return { products, loading, error };
}
