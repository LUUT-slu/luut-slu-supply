import { useState, useEffect } from 'react';
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
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCollections() {
      try {
        setLoading(true);
        const data = await storefrontApiRequest(COLLECTIONS_QUERY, { first: limit });
        if (data?.data?.collections?.edges) {
          const mapped = data.data.collections.edges.map((edge: { node: ShopifyCollection }) => edge.node);
          setCollections(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch collections:', err);
        setError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    }

    fetchCollections();
  }, [limit]);

  return { collections, loading, error };
}

// Helper to generate category path from collection handle
export function getCollectionPath(handle: string): string {
  return `/shop/${handle}`;
}
