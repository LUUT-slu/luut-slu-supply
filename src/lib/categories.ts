/**
 * Unified Product Category System
 * 
 * This defines categories that work across both Shopify and local (Lovable) products.
 * The structure maps:
 * - Collection handles (URL slugs) → Display names
 * - Display names → Shopify product type queries
 * - Local products use these exact values for the `category` field
 */

export interface ProductCategory {
  // URL-safe slug matching Shopify collection handles
  slug: string;
  // Display name for UI
  label: string;
  // Shopify product type value (what's stored in Shopify)
  shopifyType: string;
  // Shopify query for fetching products of this category
  shopifyQuery: string;
  // Keywords for flexible matching
  keywords: string[];
}

// Master category list - these match Shopify product types and collection handles
export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    slug: "beanies-tams",
    label: "Beanies & Tams",
    shopifyType: "Beanies",
    shopifyQuery: 'product_type:beanies OR product_type:"Beanies & Tams" OR title:beanie OR title:tam',
    keywords: ["beanie", "beanies", "tam", "tams", "knit hat", "winter hat"],
  },
  {
    slug: "hats",
    label: "Hats",
    shopifyType: "Hats",
    shopifyQuery: "product_type:hats OR product_type:caps OR title:hat OR title:cap",
    keywords: ["hat", "hats", "cap", "caps", "snapback", "fitted"],
  },
  {
    slug: "facewear",
    label: "Facewear",
    shopifyType: "Ski Masks / Facewear",
    shopifyQuery: 'product_type:"Ski Masks / Facewear" OR product_type:facewear OR title:ski mask OR title:balaclava OR title:face mask',
    keywords: ["ski mask", "facewear", "balaclava", "face mask", "mask"],
  },
  {
    slug: "shirts",
    label: "Shirts",
    shopifyType: "Shirts",
    shopifyQuery: "product_type:shirts OR product_type:tees OR title:shirt OR title:tee OR title:t-shirt",
    keywords: ["shirt", "shirts", "tee", "tees", "t-shirt", "polo"],
  },
  {
    slug: "hoodies",
    label: "Hoodies",
    shopifyType: "Hoodies",
    shopifyQuery: "product_type:hoodies OR product_type:sweatshirts OR title:hoodie OR title:sweatshirt",
    keywords: ["hoodie", "hoodies", "sweatshirt", "pullover"],
  },
  {
    slug: "jackets",
    label: "Jackets",
    shopifyType: "Jacket",
    shopifyQuery: "product_type:jacket OR product_type:jackets OR product_type:coats OR title:jacket OR title:vest",
    keywords: ["jacket", "jackets", "coat", "vest", "windbreaker"],
  },
  {
    slug: "pants",
    label: "Pants",
    shopifyType: "Pants",
    shopifyQuery: "product_type:pants OR product_type:jeans OR product_type:trousers OR title:pants OR title:jeans",
    keywords: ["pants", "jeans", "trousers", "joggers", "sweats"],
  },
  {
    slug: "shorts",
    label: "Shorts",
    shopifyType: "Shorts",
    shopifyQuery: "product_type:shorts OR title:shorts",
    keywords: ["shorts", "short"],
  },
  {
    slug: "boxers",
    label: "Boxers",
    shopifyType: "Boxers",
    shopifyQuery: "product_type:boxers OR product_type:underwear OR title:boxers OR title:briefs",
    keywords: ["boxers", "underwear", "briefs"],
  },
  {
    slug: "shoes",
    label: "Shoes",
    shopifyType: "Shoe",
    shopifyQuery: "product_type:shoe OR product_type:shoes OR product_type:sneakers OR title:shoes OR title:sneaker",
    keywords: ["shoes", "shoe", "sneakers", "sneaker", "kicks", "trainers"],
  },
  {
    slug: "slippers",
    label: "Slippers",
    shopifyType: "Slippers",
    shopifyQuery: "product_type:slippers OR title:slippers OR title:slides",
    keywords: ["slippers", "slides", "flip flops"],
  },
  {
    slug: "sandals",
    label: "Sandals",
    shopifyType: "Sandals",
    shopifyQuery: "product_type:sandals OR title:sandals",
    keywords: ["sandals", "sandal"],
  },
  {
    slug: "socks",
    label: "Socks",
    shopifyType: "Socks",
    shopifyQuery: "product_type:socks OR title:socks",
    keywords: ["socks", "sock"],
  },
  {
    slug: "bags",
    label: "Bags",
    shopifyType: "Bags",
    shopifyQuery: "product_type:bags OR product_type:backpacks OR title:bag OR title:backpack",
    keywords: ["bag", "bags", "backpack", "backpacks", "duffel", "tote"],
  },
  {
    slug: "accessories",
    label: "Accessories",
    shopifyType: "Accessories",
    shopifyQuery: "product_type:accessories OR title:chain OR title:necklace OR title:bracelet OR title:watch",
    keywords: ["accessories", "accessory", "chain", "necklace", "bracelet", "watch", "jewelry"],
  },
  {
    slug: "electronics",
    label: "Electronics",
    shopifyType: "Electronics",
    shopifyQuery: "product_type:electronics OR title:phone OR title:headphones OR title:speaker",
    keywords: ["electronics", "phone", "headphones", "speaker", "tech", "gadget"],
  },
  {
    slug: "other",
    label: "Other",
    shopifyType: "Other",
    shopifyQuery: "",
    keywords: ["other", "misc", "miscellaneous"],
  },
];

// Get category labels for select dropdowns (used in seller product form)
export const CATEGORY_OPTIONS = PRODUCT_CATEGORIES
  .filter(c => c.slug !== "other")
  .map(c => c.label);

// Get category by slug (collection handle)
export function getCategoryBySlug(slug: string): ProductCategory | undefined {
  return PRODUCT_CATEGORIES.find(c => c.slug === slug);
}

// Get category by label (what's stored in seller_products.category)
export function getCategoryByLabel(label: string): ProductCategory | undefined {
  if (!label) return undefined;
  const lowerLabel = label.toLowerCase();
  return PRODUCT_CATEGORIES.find(c => 
    c.label.toLowerCase() === lowerLabel ||
    c.shopifyType.toLowerCase() === lowerLabel ||
    c.keywords.some(k => k.toLowerCase() === lowerLabel)
  );
}

// Get Shopify query for a category slug
export function getShopifyQueryForSlug(slug: string): string | undefined {
  const category = getCategoryBySlug(slug);
  return category?.shopifyQuery || undefined;
}

// Get all slugs that a category label should match
export function getCategorySlugsForLabel(label: string): string[] {
  if (!label) return [];
  const category = getCategoryByLabel(label);
  return category ? [category.slug] : [];
}

// Normalize a category value for database storage
// Always stores the label (e.g., "Beanies & Tams", "Shoes")
export function normalizeCategoryForStorage(input: string): string {
  const category = getCategoryByLabel(input) || getCategoryBySlug(input);
  return category?.label || input;
}

// Check if a product's category matches a slug (for filtering)
export function categoryMatchesSlug(productCategory: string | null, slug: string): boolean {
  if (!productCategory || !slug) return false;
  
  const targetCategory = getCategoryBySlug(slug);
  if (!targetCategory) return false;
  
  const productCategoryLower = productCategory.toLowerCase();
  
  // Match by label
  if (targetCategory.label.toLowerCase() === productCategoryLower) return true;
  
  // Match by Shopify type
  if (targetCategory.shopifyType.toLowerCase() === productCategoryLower) return true;
  
  // Match by keywords
  if (targetCategory.keywords.some(k => productCategoryLower.includes(k))) return true;
  
  return false;
}

// Map Shopify productType to our category label
export function mapShopifyTypeToLabel(productType: string | null): string | null {
  if (!productType) return null;
  const lowerType = productType.toLowerCase();
  
  const category = PRODUCT_CATEGORIES.find(c =>
    c.shopifyType.toLowerCase() === lowerType ||
    c.keywords.some(k => lowerType.includes(k))
  );
  
  return category?.label || productType;
}
