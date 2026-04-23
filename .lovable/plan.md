

# Sort sold-out items last across all homepage product sections

## Goal
On the homepage, every product section/category must show **in-stock items first**, then **sold-out items last**. Sold-out items stay visible (no hiding, no badge changes) — only their order changes.

## Current behavior
- `fetchHybridProducts` already sorts by stock status (`in_stock → low_stock → out_of_stock`), but several homepage sections then **re-slice or re-shuffle** the list, which can let sold-out items jump ahead:
  - `HomeNewArrivalsSection` slices the first N from a list that may have been variant-split (splitting can append color variants in any order, mixing sold-out among in-stock).
  - `HomeCategorySection` does the same after `splitByVisualOptions`.
  - `HybridProductGrid` (used on category pages, also reachable from homepage) also does not re-sort after splitting.
  - `HomeFeaturedSection` keeps original `productIds` order (admin order) — sold-out can appear in the middle.
  - `WhatPeopleAreBuyingSection` filters to in-stock only when any exist, dropping sold-out instead of moving them to the end.
- `BestSellersSection` is driven by sales data and does not need stock reordering (no stock field exposed) — leave as is.

## Plan

### 1. Add a shared stable stock-priority sort helper
Create `src/lib/stockSort.ts` with one small utility:

- `sortByStockStatus<T extends { stockStatus: StockStatus }>(items: T[]): T[]`
  - Stable sort.
  - Order: `in_stock` (0) → `low_stock` (1) → `out_of_stock` (2).
  - Preserves existing relative order within each group (so "newest first", featured admin order, category order, etc. are all kept inside their stock bucket).

This guarantees consistent sold-out-last behavior wherever it is applied.

### 2. Apply the helper in every homepage product section

Update each of these to run `sortByStockStatus` as the **final** step before `slice(limit)` / render, so it runs after variant splitting and any other transforms:

- `src/components/HomeNewArrivalsSection.tsx`
  - Sort after `splitByVisualOptions` and before `.slice(0, limit)`.
- `src/components/HomeCategorySection.tsx`
  - Same pattern: sort after split, before slice.
- `src/components/HomeFeaturedSection.tsx`
  - Sort the mapped products before render. Within in-stock, keep the admin-defined `productIds` order; sold-out featured items move to the end of the row.
- `src/components/WhatPeopleAreBuyingSection.tsx`
  - Stop dropping sold-out when in-stock exists.
  - Build the daily-shuffled pool from the full list, then sort by stock so sold-out items go to the end of the displayed strip.
- `src/components/HybridProductGrid.tsx`
  - Sort after variant splitting and the existing `hideSoldOut` filter (so when `hideSoldOut` is off, sold-out items render last). This keeps category pages reachable from the homepage consistent.

### 3. Leave alone
- `BestSellersSection` — sales-driven, no stock data on the source rows.
- `HomepageReviews`, hero, trust, how-it-works, CTA — not product lists.
- Cart, checkout, product detail — out of scope.
- Sold-out badges, opacity styling, "Sold Out" labels — unchanged.

## Verification after implementation
On `/` for each rendered section, confirm:
1. All in-stock cards render first.
2. All sold-out cards render after.
3. No sold-out item appears between two in-stock items in the same row.
4. Sold-out badges still display.
5. Within in-stock items, existing order (newest/featured/category/daily-shuffle) is preserved.

## Files to change
- add: `src/lib/stockSort.ts`
- edit: `src/components/HomeNewArrivalsSection.tsx`
- edit: `src/components/HomeCategorySection.tsx`
- edit: `src/components/HomeFeaturedSection.tsx`
- edit: `src/components/WhatPeopleAreBuyingSection.tsx`
- edit: `src/components/HybridProductGrid.tsx`

