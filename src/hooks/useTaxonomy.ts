import { useQuery } from '@tanstack/react-query';
import { fetchTaxonomy, Taxonomy } from '@/lib/taxonomy';

/**
 * Single source of truth for marketplace category navigation.
 * Cached for 10 minutes — Shopify collection structure rarely changes.
 */
export function useTaxonomy(enabled: boolean = true) {
  const query = useQuery<Taxonomy>({
    queryKey: ['marketplace-taxonomy'],
    queryFn: fetchTaxonomy,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
  });

  return {
    taxonomy: query.data,
    mains: query.data?.mains ?? [],
    loading: query.isLoading,
    error: query.error ? 'Failed to load categories' : null,
  };
}
