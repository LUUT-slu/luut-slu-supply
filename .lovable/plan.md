
# Fix Local Product 404 & Duplicate Listings

## Problems Identified

### Problem 1: 404 Error on Local Products
The `UnifiedProductCard` generates links to `/product/local/:id` for local seller products, but **no route exists** for this path. The app only has `/product/:handle` which is designed for Shopify products.

### Problem 2: Duplicate Listings
Products synced from Shopify (via the "Sync Products" feature) exist in both:
- Shopify Storefront API
- The local `seller_products` table (with `shopify_product_id` linking them)

The hybrid product fetch combines both sources without deduplication, causing the same product to appear twice.

---

## Solution

### Fix 1: Create Local Product Detail Page
Create a new page component that fetches and displays products from the `seller_products` table, and add the missing route.

**New file: `src/pages/LocalProductDetail.tsx`**
- Fetches product by ID from `seller_products` table
- Displays product images, title, price, seller info
- Allows add-to-cart functionality
- Matches the visual style of the Shopify product page

**Route addition in `src/App.tsx`:**
```
/product/local/:productId → LocalProductDetail
```

### Fix 2: Deduplicate Synced Products
Modify `fetchHybridProducts()` to exclude Lovable products that have a `shopify_product_id` - these are synced copies and will already appear from the Shopify source.

**Update `src/lib/products.ts`:**
- In `fetchLovableProducts()`, add filter: `.is('shopify_product_id', null)`
- This ensures only **truly local** products (not synced from Shopify) are included from the database

---

## Implementation Details

### New LocalProductDetail Page

```text
Layout:
┌─────────────────────────────┐
│ ← Back           [Header]   │
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │   Product Image     │    │
│  │   (swipeable)       │    │
│  └─────────────────────┘    │
│                             │
│  Local Seller  [Seller Name]│
│  Product Title              │
│  EC$XX.XX                   │
│                             │
│  Quantity: [ - ] 1 [ + ]    │
│                             │
│  [Add to Cart - EC$XX.XX]   │
│  [Buy Now]                  │
│                             │
│  Meetup Locations           │
│  Payment Info               │
└─────────────────────────────┘
```

### Deduplication Logic

Before (causes duplicates):
```typescript
const [shopifyProducts, lovableProducts] = await Promise.all([
  fetchProducts(limit, finalShopifyQuery),
  fetchLovableProducts(),  // Includes synced products
]);
```

After (no duplicates):
```typescript
// fetchLovableProducts now filters out synced products
.is('shopify_product_id', null)  // Only truly local products
```

---

## Files to Change

| File | Action |
|------|--------|
| `src/pages/LocalProductDetail.tsx` | CREATE - New page for local products |
| `src/App.tsx` | MODIFY - Add route `/product/local/:productId` |
| `src/lib/products.ts` | MODIFY - Filter out synced products in `fetchLovableProducts()` |

---

## Benefits

1. **404 Fixed**: Local product links will work correctly
2. **No Duplicates**: Synced Shopify products only appear once (from Shopify source)
3. **Consistent UX**: Local product page matches Shopify product page styling
4. **Data Integrity**: Products managed in Shopify remain the "source of truth" for synced items
