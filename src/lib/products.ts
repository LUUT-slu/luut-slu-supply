import { supabase } from '@/integrations/supabase/client';
import { ShopifyProduct, fetchProducts } from './shopify';

// Unified product interface that works for both Shopify and Lovable products
export interface UnifiedProduct {
  id: string;
  source: 'shopify' | 'lovable';
  title: string;
  description: string;
  handle: string;
  vendor: string;
  category: string | null;
  price: {
    amount: string;
    currencyCode: string;
  };
  images: Array<{
    url: string;
    altText: string | null;
  }>;
  variants: Array<{
    id: string;
    title: string;
    price: {
      amount: string;
      currencyCode: string;
    };
    availableForSale: boolean;
    selectedOptions: Array<{
      name: string;
      value: string;
    }>;
  }>;
  // Original data for cart operations
  originalShopifyProduct?: ShopifyProduct;
  originalLovableProduct?: LovableProduct;
}

export interface LovableProduct {
  id: string;
  seller_id: string;
  name: string;
  price: number;
  quantity: number;
  location: string | null;
  description: string | null;
  images: string[] | null;
  category: string | null;
  status: string;
  created_at: string;
  seller_name?: string;
}

// Convert Shopify product to unified format
function shopifyToUnified(product: ShopifyProduct): UnifiedProduct {
  const node = product.node;
  return {
    id: node.id,
    source: 'shopify',
    title: node.title,
    description: node.description,
    handle: node.handle,
    vendor: node.vendor,
    category: node.productType || null,
    price: {
      amount: node.priceRange.minVariantPrice.amount,
      currencyCode: node.priceRange.minVariantPrice.currencyCode,
    },
    images: node.images.edges.map(e => ({
      url: e.node.url,
      altText: e.node.altText,
    })),
    variants: node.variants.edges.map(v => ({
      id: v.node.id,
      title: v.node.title,
      price: v.node.price,
      availableForSale: v.node.availableForSale,
      selectedOptions: v.node.selectedOptions,
    })),
    originalShopifyProduct: product,
  };
}

// Convert Lovable product to unified format
function lovableToUnified(product: LovableProduct): UnifiedProduct {
  // Create a pseudo-handle from the product name
  const handle = `lovable-${product.id}`;
  
  return {
    id: product.id,
    source: 'lovable',
    title: product.name,
    description: product.description || '',
    handle,
    vendor: product.seller_name || 'Local Seller',
    category: product.category,
    price: {
      amount: product.price.toString(),
      currencyCode: 'XCD',
    },
    images: (product.images || []).map(url => ({
      url,
      altText: product.name,
    })),
    variants: [{
      id: `lovable-variant-${product.id}`,
      title: 'Default',
      price: {
        amount: product.price.toString(),
        currencyCode: 'XCD',
      },
      availableForSale: product.quantity > 0 && product.status === 'active',
      selectedOptions: [],
    }],
    originalLovableProduct: product,
  };
}

// Fetch Lovable seller products by category
export async function fetchLovableProducts(category?: string): Promise<LovableProduct[]> {
  let query = supabase
    .from('seller_products')
    .select(`
      *,
      seller_profiles!inner(seller_name)
    `)
    .eq('status', 'active')
    .gt('quantity', 0);

  if (category) {
    query = query.ilike('category', `%${category}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching Lovable products:', error);
    return [];
  }

  return (data || []).map(p => ({
    ...p,
    seller_name: (p.seller_profiles as any)?.seller_name || 'Local Seller',
  }));
}

// Fetch combined products from both sources
export async function fetchHybridProducts(options: {
  category?: string;
  shopifyQuery?: string;
  limit?: number;
}): Promise<UnifiedProduct[]> {
  const { category, shopifyQuery, limit = 50 } = options;

  // Fetch from both sources in parallel
  const [shopifyProducts, lovableProducts] = await Promise.all([
    fetchProducts(limit, shopifyQuery).catch(() => [] as ShopifyProduct[]),
    fetchLovableProducts(category).catch(() => [] as LovableProduct[]),
  ]);

  // Convert and combine
  const unifiedShopify = shopifyProducts.map(shopifyToUnified);
  const unifiedLovable = lovableProducts.map(lovableToUnified);

  // Combine with Lovable products first (local sellers priority)
  return [...unifiedLovable, ...unifiedShopify];
}

// Check if a product is from Lovable (for cart/checkout logic)
export function isLovableProduct(product: UnifiedProduct): boolean {
  return product.source === 'lovable';
}

// Get product ID for Lovable products (strips prefix)
export function getLovableProductId(product: UnifiedProduct): string | null {
  if (product.source !== 'lovable') return null;
  return product.id;
}
