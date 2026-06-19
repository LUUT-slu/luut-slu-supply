import { toast } from "sonner";

const SHOPIFY_API_VERSION = '2025-07';
const SHOPIFY_STORE_PERMANENT_DOMAIN = 'lovable-project-yf43m.myshopify.com';
const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
const SHOPIFY_STOREFRONT_TOKEN = 'bba236c8d95e42671f4ad638548fda67';

export interface ShopifyProduct {
  node: {
    id: string;
    title: string;
    description: string;
    handle: string;
    vendor: string;
    productType: string;
    tags: string[];
    createdAt: string;
    /** Collection handles this product belongs to (populated when fetched via list/collection queries). */
    collectionHandles?: string[];
    priceRange: {
      minVariantPrice: {
        amount: string;
        currencyCode: string;
      };
    };
    images: {
      edges: Array<{
        node: {
          url: string;
          altText: string | null;
        };
      }>;
    };
    variants: {
      edges: Array<{
        node: {
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
        };
      }>;
    };
    options: Array<{
      name: string;
      values: string[];
    }>;
  };
}

// 10s hard cap so Shopify can never hang the homepage / hooks
const SHOPIFY_REQUEST_TIMEOUT_MS = 10_000;

export async function storefrontApiRequest(query: string, variables: Record<string, unknown> = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SHOPIFY_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(SHOPIFY_STOREFRONT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error)?.name === 'AbortError') {
      console.warn('[shopify] request timed out after', SHOPIFY_REQUEST_TIMEOUT_MS, 'ms');
      return null;
    }
    console.warn('[shopify] request failed:', (err as Error)?.message);
    return null;
  }
  clearTimeout(timeoutId);

  if (response.status === 402) {
    toast.error("Shopify: Payment required", {
      description: "Shopify API access requires an active billing plan."
    });
    return null;
  }

  if (!response.ok) {
    console.warn('[shopify] HTTP', response.status);
    return null;
  }

  const data = await response.json().catch(() => null);
  if (!data) return null;

  if (data.errors) {
    console.warn('[shopify] GraphQL errors:', data.errors);
    return null;
  }

  return data;
}

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
    products(first: $first, query: $query, sortKey: $sortKey, reverse: $reverse) {
      edges {
        node {
          id
          title
          description
          handle
          vendor
          productType
          tags
          createdAt
          collections(first: 10) {
            edges {
              node {
                handle
              }
            }
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 40) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
                availableForSale
                image {
                  url
                  altText
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          options {
            name
            values
          }
        }
      }
    }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = `
  query GetProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      description
      handle
      vendor
      productType
      tags
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      images(first: 40) {
        edges {
          node {
            url
            altText
          }
        }
      }
      variants(first: 50) {
        edges {
          node {
            id
            title
            price {
              amount
              currencyCode
            }
            availableForSale
            image {
              url
              altText
            }
            selectedOptions {
              name
              value
            }
          }
        }
      }
      options {
        name
        values
      }
    }
  }
`;

const COLLECTION_PRODUCTS_QUERY = `
  query GetCollectionByHandle($handle: String!, $first: Int!) {
    collectionByHandle(handle: $handle) {
      id
      title
      products(first: $first) {
        edges {
          node {
            id
            title
            description
            handle
            vendor
            productType
            tags
            createdAt
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            images(first: 40) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  availableForSale
                  image {
                    url
                    altText
                  }
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
            options {
              name
              values
            }
          }
        }
      }
    }
  }
`;

export type ProductSortKey = 'TITLE' | 'PRODUCT_TYPE' | 'VENDOR' | 'UPDATED_AT' | 'CREATED_AT' | 'BEST_SELLING' | 'PRICE';

function attachCollectionHandles(edges: any[]): ShopifyProduct[] {
  return (edges || []).map((edge: any) => {
    const node = edge?.node ?? edge;
    const handles: string[] = Array.isArray(node?.collections?.edges)
      ? node.collections.edges.map((e: any) => e?.node?.handle).filter(Boolean)
      : [];
    return { node: { ...node, collectionHandles: handles } } as ShopifyProduct;
  });
}

export async function fetchProducts(
  first: number = 50,
  query?: string,
  sortKey: ProductSortKey = 'CREATED_AT',
  reverse: boolean = true
): Promise<ShopifyProduct[]> {
  const data = await storefrontApiRequest(PRODUCTS_QUERY, { first, query, sortKey, reverse });
  if (!data) return [];
  return attachCollectionHandles(data.data.products.edges);
}

export async function fetchProductsByCollection(
  collectionHandle: string,
  first: number = 50
): Promise<ShopifyProduct[]> {
  const data = await storefrontApiRequest(COLLECTION_PRODUCTS_QUERY, { handle: collectionHandle, first });
  if (!data) return [];
  const collection = data.data?.collectionByHandle;
  if (!collection) return [];
  // Decorate every product in this collection with the current handle so the
  // shared pricing layer can match collection-targeted promotions.
  return (collection.products.edges || []).map((edge: any) => {
    const node = edge?.node ?? edge;
    const existing: string[] = Array.isArray(node?.collectionHandles) ? node.collectionHandles : [];
    return { node: { ...node, collectionHandles: Array.from(new Set([...existing, collectionHandle])) } } as ShopifyProduct;
  });
}

export async function fetchProductsByVendor(vendorFilter: string): Promise<ShopifyProduct[]> {
  // Fetch all products and filter by vendor containing the filter string
  const allProducts = await fetchProducts(100);
  return allProducts.filter(product => 
    product.node.vendor.toLowerCase().includes(vendorFilter.toLowerCase())
  );
}

export async function fetchProductByHandle(handle: string): Promise<ShopifyProduct['node'] | null> {
  const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle });
  if (!data) return null;
  return data.data.productByHandle;
}

const PRODUCT_BY_ID_QUERY = `
  query GetProductById($id: ID!) {
    node(id: $id) {
      ... on Product {
        id
        title
        handle
        images(first: 10) {
          edges { node { url altText } }
        }
        variants(first: 50) {
          edges {
            node {
              id
              title
              price { amount currencyCode }
              availableForSale
              image { url altText }
              selectedOptions { name value }
            }
          }
        }
        options { name values }
      }
    }
  }
`;

export interface ShopifyVariantLite {
  id: string;
  title: string;
  price: { amount: string; currencyCode: string };
  availableForSale: boolean;
  image?: { url: string; altText: string | null } | null;
  selectedOptions: Array<{ name: string; value: string }>;
}

export async function fetchProductVariantsById(productGid: string): Promise<{
  variants: ShopifyVariantLite[];
  options: Array<{ name: string; values: string[] }>;
} | null> {
  const data = await storefrontApiRequest(PRODUCT_BY_ID_QUERY, { id: productGid });
  const node = data?.data?.node;
  if (!node) return null;
  return {
    variants: node.variants.edges.map((e: { node: ShopifyVariantLite }) => e.node),
    options: node.options || [],
  };
}

// Cart checkout with note support
const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export interface MeetupDetails {
  customerName: string;
  location: string;
  preferredDate: string;
  note?: string;
}

export async function createStorefrontCheckout(
  items: { variantId: string; quantity: number }[],
  meetupDetails?: MeetupDetails
): Promise<string> {
  const lines = items.map(item => ({
    quantity: item.quantity,
    merchandiseId: item.variantId,
  }));

  // Build note with meetup details
  let note = '';
  if (meetupDetails) {
    note = `📍 Meetup Location: ${meetupDetails.location}\n📅 Preferred Date: ${meetupDetails.preferredDate}\n👤 Customer: ${meetupDetails.customerName}`;
    if (meetupDetails.note) {
      note += `\n📝 Note: ${meetupDetails.note}`;
    }
  }

  const cartData = await storefrontApiRequest(CART_CREATE_MUTATION, {
    input: { 
      lines,
      note: note || undefined,
    },
  });

  if (!cartData) {
    throw new Error('Failed to create checkout');
  }

  if (cartData.data.cartCreate.userErrors.length > 0) {
    throw new Error(`Cart creation failed: ${cartData.data.cartCreate.userErrors.map((e: { message: string }) => e.message).join(', ')}`);
  }

  const cart = cartData.data.cartCreate.cart;
  
  if (!cart.checkoutUrl) {
    throw new Error('No checkout URL returned from Shopify');
  }

  const url = new URL(cart.checkoutUrl);
  url.searchParams.set('channel', 'online_store');
  return url.toString();
}

/**
 * Optimizes a Shopify CDN image URL by requesting a specific width.
 * Shopify CDN supports on-the-fly image resizing via URL parameters.
 * This dramatically reduces download size for product images.
 */
/**
 * Normalizes vendor names to canonical seller names.
 * Maps any variant of "Luut SLU" (e.g. "Luut SLU Hub", "Luut SLU (Certified Seller)")
 * to the canonical "Luut SLU" admin seller account name.
 */
export function normalizeVendorName(vendor: string): string {
  if (vendor.toLowerCase().includes("luut slu")) return "Luut SLU";
  return vendor;
}

/**
 * Optimizes an image URL by requesting a specific width.
 * Supports:
 *  - Shopify CDN (cdn.shopify.com): width + format=webp + crop=center
 *  - Supabase Storage (*.supabase.co/storage/v1/object/public/...):
 *    rewrites to /render/image/public/... with width + quality + resize=cover
 *  - Other URLs: returned unchanged
 *
 * @param dpr device pixel ratio multiplier (default 1, capped at 2). Pass
 *   `window.devicePixelRatio` to get sharper images on retina/mobile.
 */
export function getOptimizedImageUrl(url: string, width: number, dpr: number = 1): string {
  if (!url) return url;
  const cappedDpr = Math.max(1, Math.min(2, dpr || 1));
  const targetWidth = Math.round(width * cappedDpr);

  // Shopify CDN
  if (url.includes('cdn.shopify.com')) {
    try {
      const imgUrl = new URL(url);
      imgUrl.searchParams.set('width', String(targetWidth));
      imgUrl.searchParams.set('format', 'webp');
      imgUrl.searchParams.set('crop', 'center');
      return imgUrl.toString();
    } catch {
      return url;
    }
  }

  // Supabase Storage public objects → rewrite to image transform endpoint
  if (url.includes('.supabase.co/storage/v1/object/public/')) {
    try {
      const transformed = url.replace(
        '/storage/v1/object/public/',
        '/storage/v1/render/image/public/',
      );
      const imgUrl = new URL(transformed);
      imgUrl.searchParams.set('width', String(targetWidth));
      imgUrl.searchParams.set('quality', '75');
      imgUrl.searchParams.set('resize', 'cover');
      return imgUrl.toString();
    } catch {
      return url;
    }
  }

  return url;
}

/**
 * Builds a srcSet string for responsive `<img srcset>`.
 * Generates [w, w*1.5, w*2] entries when the host supports transforms.
 */
export function getImageSrcSet(url: string, baseWidth: number): string | undefined {
  if (!url) return undefined;
  const supports = url.includes('cdn.shopify.com') || url.includes('.supabase.co/storage/v1/object/public/');
  if (!supports) return undefined;
  const widths = [baseWidth, Math.round(baseWidth * 1.5), baseWidth * 2];
  return widths.map((w) => `${getOptimizedImageUrl(url, w)} ${w}w`).join(', ');
}
