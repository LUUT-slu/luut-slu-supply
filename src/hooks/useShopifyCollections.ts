import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest } from '@/lib/shopify';

export interface ShopifyCollection {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: {
    url: string;
    altText: string | null;
  } | null;
}

const COLLECTIONS_QUERY = `
  query GetCollections($first: Int!) {
    collections(first: $first) {
      edges {
        node {
          id
          handle
          title
          description
          image {
            url
            altText
          }
        }
      }
    }
  }
`;

export function useShopifyCollections(limit: number = 50) {
  const { data: collections = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['shopify-collections', limit],
    queryFn: async (): Promise<ShopifyCollection[]> => {
      const data = await storefrontApiRequest(COLLECTIONS_QUERY, { first: limit });
      if (data?.data?.collections?.edges) {
        return data.data.collections.edges.map((edge: { node: ShopifyCollection }) => edge.node);
      }
      return [];
    },
    staleTime: 10 * 60 * 1000, // 10 min — collections rarely change
  });

  const error = queryError ? 'Failed to load categories' : null;

  return { collections, loading, error };
}

// Helper to generate category path from collection handle
export function getCollectionPath(handle: string): string {
  return `/shop/${handle}`;
}
