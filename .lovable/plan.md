# Homepage: Dynamic Shopify Marketplace Feed

Replace the hardcoded category pills and stacked collection sections with a single dynamic feed driven by real Shopify collections.

## What changes

**Mobile homepage (`src/pages/Index.tsx`)** will render only:
1. `MobileHeader`
2. `HeroSlider`
3. New `MarketplaceFeed` (pills + unified product grid)
4. `HomepageReviews`, Trust, How It Works, CTA, Footer, `MobileBottomNav`

All `HomeCategorySection`, `HomeFeaturedSection`, `HomeNewArrivalsSection`, `BestSellersSection`, `WhatPeopleAreBuyingSection`, and admin-configured `sections` rendering are removed from the mobile view (desktop keeps existing layout untouched to avoid scope creep — confirm if you also want desktop simplified).

## New component: `src/components/home/MarketplaceFeed.tsx`

- Fetches collections via existing `useShopifyCollections()` — pills = `[All, ...collections]`, generated dynamically from Shopify. Renamed/added/deleted collections appear automatically.
- Active pill state stored locally; tapping filters instantly (no route change).
- Uses existing `useHybridProducts({ categorySlug: activeHandle, limit: 40 })` which already calls `fetchProductsByCollection(handle)` — exact Shopify collection membership.
- "All" tab: fetches without categorySlug + merges in best-sellers signal by sorting:
  1. in_stock → low_stock → out_of_stock (via `sortByStockStatus`)
  2. within in-stock: best-sellers first (cross-ref `useProductSalesCounts` lookup), then newest (Shopify returns newest by default)
- Renders a 2-col mobile / 3–4-col desktop grid using `UnifiedProductCard` with `priority` on first 2 cards.
- Skeletons while loading; empty state when collection has no products.
- Pills row: horizontal scroll, gold active pill, dark inactive — matches current `InStockNowSection` styling.

## Deletions

- `src/components/home/InStockNowSection.tsx` (superseded by `MarketplaceFeed`).
- Remove the `sections.map(...)` block and related imports from `Index.tsx` for mobile rendering path.

## Files touched

- **new**: `src/components/home/MarketplaceFeed.tsx`
- **edit**: `src/pages/Index.tsx` (mobile branch only)
- **delete**: `src/components/home/InStockNowSection.tsx`

## Out of scope

- Desktop homepage layout (still shows hero + dynamic sections). Tell me if you want the same single-feed treatment on desktop.
- Admin Homepage Editor — still works for desktop and other pages.
- Wishlist persistence, product card redesign, checkout.

## Open question

Should the desktop homepage also collapse into the single pills+feed layout, or keep its current section-based design?
