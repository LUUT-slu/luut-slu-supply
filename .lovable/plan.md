

# Switch Best Sellers to Shopify-powered data

## Shopify signal used

**Primary source: Shopify Storefront API `products(sortKey: BEST_SELLING)`**

This is Shopify's official best-seller ranking. It uses Shopify's internal sales-performance signal across the store (the same ranking that powers the "Best selling" sort in collections) and updates automatically as orders are placed in Shopify. No manual curation required.

- Endpoint: `POST /api/2025-07/graphql.json`
- Query: `products(first: N, sortKey: BEST_SELLING, query: "available_for_sale:true")`
- Already supported by `src/lib/shopify.ts` (`ProductSortKey` already includes `'BEST_SELLING'`).

**Fallback (graceful):** if Shopify returns `null`/empty (timeout, 4xx/5xx, payment-required, network), fall back to the existing Supabase `weekly_best_sellers` view so the section still renders.

## Plan

### 1. New reusable hook: `src/hooks/useShopifyBestSellers.ts`
- React Query hook (`queryKey: ['shopify-best-sellers', limit]`).
- Calls `fetchProducts(limit, 'available_for_sale:true', 'BEST_SELLING', false)`.
- Maps to `UnifiedProduct[]` (reuse the existing `shopifyToUnified` mapper — export it from `src/lib/products.ts`).
- Applies `sortByStockStatus` so any sold-out items appear last (matches the homepage rule; sold-out still allowed per the "Best Sellers can have sold out items" rule).
- On empty/error, returns `{ products: [], usedFallback: false }` and lets the consumer try the fallback.
- 5-minute `staleTime` for speed; non-blocking (no `suspense`).

### 2. New combined hook: `useBestSellersUnified(limit)`
- Calls `useShopifyBestSellers` first.
- If empty/errored, calls existing `useBestSellers` (Supabase view) and maps those rows to a minimal `UnifiedProduct`-compatible shape so the UI can render with one component.
- Returns `{ products, isLoading, source: 'shopify' | 'local' | 'none' }` so we can log/verify which signal is live.

### 3. Update `src/components/BestSellersSection.tsx`
- Replace `useBestSellers` with `useBestSellersUnified`.
- Render via the existing `UnifiedProductCard` so titles, prices, images, variants, stock badges, and product links all stay synced with Shopify.
- Keep the `#1 / #2 / #3` rank badge overlay for the first three.
- Keep "do not block homepage": loading skeleton stays, errors render `null` (section just hides), no thrown errors.
- Console-log the active source once per mount (`[best-sellers] source=shopify` or `local`) for verification.

### 4. Update `src/pages/BestSellers.tsx` (the `/shop/best-sellers` page)
- Use the same `useBestSellersUnified` hook with a higher limit (e.g. 24).
- Reuse `UnifiedProductCard` grid for consistent links/stock/variants.
- Reviews section stays as-is.

### 5. Leave alone (out of scope)
- Existing `useBestSellers` + `weekly_best_sellers` view — kept as fallback and still used by `MarketingStudio` poster generator (`useMarketingProducts` "bestsellers"). No marketing flow regressions.
- `recordSale` writes to `product_sales` — kept; powers fallback.
- `src/lib/stockSort.ts` — already used.

## Failure handling
- Shopify request already has a 10s `AbortController` timeout in `storefrontApiRequest` and returns `null` instead of throwing.
- Hook surfaces `null` → triggers Supabase fallback.
- If both empty → component returns `null` (section hidden, page not blocked).

## Verification after implementation
1. Open homepage → Network tab shows a Storefront GraphQL request with `sortKey: "BEST_SELLING"` and `query: "available_for_sale:true"`.
2. Console shows `[best-sellers] source=shopify`.
3. Best Sellers cards render real Shopify products with correct titles, prices, images, and links matching the live store.
4. Toggling a product's availability in Shopify reflects after cache (5 min) or hard refresh.
5. Sold-out items, if any appear, render last in the grid.
6. Simulating Shopify failure (block storefront domain) → console shows `[best-sellers] source=local`, section still renders from Supabase view.
7. Homepage TTI is unaffected (request runs in parallel, never blocks render).

## Files to change
- add: `src/hooks/useShopifyBestSellers.ts`
- add: `src/hooks/useBestSellersUnified.ts`
- edit: `src/lib/products.ts` (export `shopifyToUnified`)
- edit: `src/components/BestSellersSection.tsx`
- edit: `src/pages/BestSellers.tsx`

