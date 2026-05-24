## Problem

Only one of the two active promotion campaigns visibly discounts products. Root cause: products with multiple color/visual variants are exploded into separate `VariantListingProduct` entries in `src/lib/variantSplitter.ts` with synthetic ids of the form `${originalProductId}__${variantSlug}`. The pricing engine in `src/lib/pricing.ts` matches `product_refs[].id === product.id` strictly, so the suffixed ids never line up with the original Shopify GID stored in `promotion_campaigns.product_refs`. The "Clearance Sale - Beanies" campaign therefore misses the cards it should discount, while "Clearance Sale - Designer Beanies" works because those refs happen to be single-variant.

This also affects future `exclude_product_ids` checks for any variant-split product.

## Fix

1. **`src/lib/variantSplitter.ts`** — expose the original product id on every split listing by adding an `originalProductId: string` field (set to `product.id`) on `VariantListingProduct`. Keeps the existing suffixed `id` so links/keys stay unique.

2. **`src/lib/pricing.ts`** — extend `PriceableProduct` with an optional `originalId?: string`. In `matchRank`, build a small `ids` set containing both `p.id` and `p.originalId` (when present), and also a defensive `p.id.split('__')[0]` fallback so older callers still benefit without code changes. Use that set for both `product_refs` matching and `exclude_product_ids` matching.

3. **`src/components/UnifiedProductCard.tsx`** — when calling `useResolvedPrice`, pass `originalId: isVariantListing(product) ? product.originalProductId : product.id` (after step 1 lands, just `product.originalProductId ?? product.id`).

4. **`src/components/ProductCard.tsx`** — no change needed; `node.id` is always the original Shopify GID.

5. **Cache key in `src/hooks/useActivePromotions.ts`** — include `originalId` in the memo key string so resolution re-runs correctly when only the original id differs from the split id.

## Verification

- Reload `/`; both campaigns' products show strikethrough original + discounted price + sale ribbon.
- "Beanies" (`7721144975465`) and "Fluffy Mask" (`7667312754793`) show $30 → $20 and $40 → $30 across every variant card.
- "Chrome Hearts Beanies" and "Lv Beanie" continue to show $110 → $75.
- Toggling either campaign `is_active` off in the DB removes its discount within the 60s query cache.
- No layout / styling changes; only the matching logic is touched.

## Out of scope

- Building the Promotion Editor UI for `target_mode` / collections / categories / banner fields (still pending from prior plan).
- `SaleBanner` / `SalePopup` wiring to active campaigns.
- Cart/checkout price recomputation (already snapshot at add-time).
