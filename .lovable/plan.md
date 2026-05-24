# Auto-detect promo items + countdown timers

Right now the PROMOS homepage section only pulls products from one collection handle (`slug`) and then keeps the ones that resolve to a discount. If a campaign targets specific products, categories, or the whole site, those items never show up. There is also no visible "limited time" cue on individual cards.

## 1. Auto-scan mode in PROMOS section

Add an `autoScan` flag to the `promo_collection` homepage section (default ON).

When `autoScan` is enabled, `PromoCollectionSection` ignores `slug` for fetching and instead aggregates products from every active campaign:

- For each active campaign (`useActivePromotionCampaigns`):
  - `target_mode = "products"` → use the products in `product_refs` (already carry `id`, `title`, `image`, `price`).
  - `target_mode = "collections"` → fetch via `useHybridProducts({ categorySlug: handle })` for each target collection handle.
  - `target_mode = "categories"` → fetch via `useHybridProducts({ mainCategory })` for each category.
  - `target_mode = "sitewide"` → fetch a broad page via `useHybridProducts({ limit })` (capped).
- Merge, dedupe by `id`, drop excluded ids, filter through `resolveProductPrice` so only truly discounted ones remain, sort by stock then by largest `percentOff`, slice to `limit`.

When `autoScan` is OFF, keep the current single-collection behavior (back-compat for stores that pinned a specific collection).

The section auto-hides if there are zero discounted products and `showEmptyState` is false (existing behavior preserved).

## 2. Countdown timer in PROMOS header

If any matched active campaign has an `end_date`, replace the static "Limited time" pill in `PromoCollectionSection` with a live `useCountdown` badge ("Ends in 2D 14H 03M"). Picks the soonest-ending active campaign among those contributing products.

## 3. Countdown timer on product cards

In `UnifiedProductCard`, when `resolved.hasDiscount` is true and the matching campaign has an `end_date`, show a small destructive-tinted pill below the price: a flame icon + "Ends 2D 14H".

To make this work, `resolveProductPrice` returns the matching `campaignId` already. Extend `ResolvedPrice` with `endDate?: string | null` so the card can render the timer without re-querying campaigns. `useResolvedPrice` already has access to active campaigns — pass `end_date` through `resolveProductPrice`.

Hide the timer when within ~5 seconds of expiry to avoid flashing zeros (the campaign will flip to `expired` on next refetch).

## 4. Admin toggle

In `HomepageEditor.tsx`, for `promo_collection` sections add:
- `autoScan` checkbox (default true) — label: "Auto-include all products from active promotions"
- Helper text explaining the section will scan every active campaign.

The existing `promoCollectionHandle` / `slug` field stays, but is only used when `autoScan` is off.

## Technical notes

Files touched (UI/presentation only, no DB changes):

- `src/lib/pricing.ts` — add `endDate?: string | null` to `ResolvedPrice`, populate from chosen campaign.
- `src/hooks/useSiteSettings.ts` — add `autoScan?: boolean` to `HomepageSection`; default `true` for the canonical sec-promos entry; migration sets it to `true` for existing promo sections.
- `src/components/home/PromoCollectionSection.tsx` — implement auto-scan aggregation and header countdown.
- `src/components/UnifiedProductCard.tsx` — render countdown pill when `resolved.endDate` is set and discount is active.
- `src/components/admin/HomepageEditor.tsx` — expose `autoScan` toggle and helper copy.
- `src/pages/Index.tsx` — pass through any new section fields (small prop wiring only).

No database migration, no edge function changes, no changes to `usePromotionCampaigns` or `useHybridProducts` signatures.
