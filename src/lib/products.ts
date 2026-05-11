import { supabase } from '@/integrations/supabase/client';
import { ShopifyProduct, fetchProducts, fetchProductsByCollection, normalizeVendorName } from './shopify';
import { categoryMatchesSlug, mapShopifyTypeToLabel, getShopifyQueryForSlug } from './categories';

// Unified product interface that works for both Shopify and Lovable products
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface UnifiedProduct {
  id: string;
  source: 'shopify' | 'lovable';
  title: string;
  description: string;
  handle: string;
  vendor: string;
  category: string | null;
  stockStatus: StockStatus;
  quantity?: number;
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
    image?: {
      url: string;
      altText: string | null;
    } | null;
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
function deriveStockStatus(quantity: number | undefined, availableForSale: boolean): StockStatus {
  if (quantity !== undefined) {
    if (quantity === 0) return 'out_of_stock';
    if (quantity <= 5) return 'low_stock';
    return 'in_stock';
  }
  // Shopify: no granular quantity, use boolean
  return availableForSale ? 'in_stock' : 'out_of_stock';
}

export function shopifyToUnified(product: ShopifyProduct): UnifiedProduct {
  const node = product.node;
  const normalizedCategory = mapShopifyTypeToLabel(node.productType);
  const anyAvailable = node.variants.edges.some(v => v.node.availableForSale);
  
  return {
    id: node.id,
    source: 'shopify',
    title: node.title,
    description: node.description,
    handle: node.handle,
    vendor: normalizeVendorName(node.vendor),
    category: normalizedCategory,
    stockStatus: deriveStockStatus(undefined, anyAvailable),
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
      image: v.node.image || null,
      selectedOptions: v.node.selectedOptions,
    })),
    originalShopifyProduct: product,
  };
}

// Convert Lovable product to unified format
function lovableToUnified(product: LovableProduct): UnifiedProduct {
  const handle = `lovable-${product.id}`;
  
  return {
    id: product.id,
    source: 'lovable',
    title: product.name,
    description: product.description || '',
    handle,
    vendor: product.seller_name || 'Local Seller',
    category: product.category,
    stockStatus: deriveStockStatus(product.quantity, product.quantity > 0),
    quantity: product.quantity,
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

// Fetch Lovable seller products - fetches all active products
// Category filtering happens in fetchHybridProducts using categoryMatchesSlug
export async function fetchLovableProducts(): Promise<LovableProduct[]> {
  const { data, error } = await supabase
    .from('seller_products')
    .select(`
      *,
      seller_profiles!inner(seller_name)
    `)
    .eq('status', 'active')
    .is('shopify_product_id', null)  // Exclude synced Shopify products to prevent duplicates
    .order('created_at', { ascending: false });

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
  categorySlug?: string;  // URL slug like "beanies-tams" OR Shopify collection handle "clothing--beanies"
  shopifyQuery?: string;  // Override Shopify query
  limit?: number;
  /** New marketplace taxonomy filters for local seller_products */
  mainCategory?: string;
  subCategory?: string;
}): Promise<UnifiedProduct[]> {
  const { categorySlug, shopifyQuery, limit = 50, mainCategory, subCategory } = options;

  // Fetch from both sources in parallel
  // For Shopify: use collection-based query when categorySlug is provided (exact Shopify membership)
  // Fall back to product_type query only if collection returns empty or shopifyQuery is overridden
  const shopifyPromise = (async () => {
    if (shopifyQuery) {
      // Explicit query override - use product search
      return fetchProducts(limit, shopifyQuery).catch(() => [] as ShopifyProduct[]);
    }
    if (categorySlug) {
      // Try collection-based fetch first (exact Shopify collection membership)
      try {
        const collectionProducts = await fetchProductsByCollection(categorySlug, limit);
        if (collectionProducts.length > 0) return collectionProducts;
      } catch (e) {
        console.warn('Collection fetch failed, falling back to product_type query:', e);
      }
      // Fallback to product_type query if collection not found
      const fallbackQuery = getShopifyQueryForSlug(categorySlug);
      if (fallbackQuery) {
        return fetchProducts(limit, fallbackQuery).catch(() => [] as ShopifyProduct[]);
      }
      return [] as ShopifyProduct[];
    }
    // No category - fetch all
    return fetchProducts(limit).catch(() => [] as ShopifyProduct[]);
  })();

  const [shopifyProducts, lovableProducts] = await Promise.all([
    shopifyPromise,
    fetchLovableProducts().catch(() => [] as LovableProduct[]),
  ]);

  // Convert to unified format
  const unifiedShopify = shopifyProducts.map(shopifyToUnified);
  let unifiedLovable = lovableProducts.map(lovableToUnified);

  // Filter Lovable products by category if slug provided
  if (categorySlug) {
    unifiedLovable = unifiedLovable.filter(p => 
      categoryMatchesSlug(p.category, categorySlug)
    );
  }

  // Combine and sort by stock status: in_stock first, low_stock second, out_of_stock last
  const combined = [...unifiedLovable, ...unifiedShopify];
  const stockOrder: Record<StockStatus, number> = { in_stock: 0, low_stock: 1, out_of_stock: 2 };
  combined.sort((a, b) => stockOrder[a.stockStatus] - stockOrder[b.stockStatus]);
  return combined;
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
