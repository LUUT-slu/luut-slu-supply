# Fix PROMOS placement on current homepage layout

## Goal
Force the PROMOS section into a fixed slot: **below the hero, above the horizontal category chip scroll**, on both mobile and desktop. Stop the auto-prioritize logic that reorders it among other admin sections.

## Layout order after fix
1. Hero / HeroSlider
2. **PROMOS** (dedicated slot)
3. Horizontal category chip scroll (mobile `MarketplaceFeed`) / desktop sections
4. Product listings / remaining sections

## Changes

### 1. `src/hooks/useSiteSettings.ts`
- Add `emptyStateMessage?: string` and `showEmptyState?: boolean` to `HomepageSection`.
- Add a single canonical promo section to `DEFAULT_HOMEPAGE_LAYOUT.sections` (placed first), e.g.:
  ```
  { id: "sec-promos", type: "promo_collection", label: "PROMOS",
    subtitle: "Limited time deals", limit: 8, enabled: true,
    autoPrioritize: true, promoCollectionHandle: "" }
  ```
- Migration in `fetchSiteSettings`: if the stored layout has no `promo_collection` section, prepend the default one so existing users get it without losing their order.

### 2. `src/components/home/PromoCollectionSection.tsx`
- Accept new props `emptyStateMessage?: string` and `showEmptyState?: boolean`.
- When 0 discounted products: render the empty-state message if `showEmptyState`, otherwise return `null` (unchanged).
- Keep existing badge (SALE/CLEARANCE/PROMO), crossed-out original price, and discounted price via existing `UnifiedProductCard` + `resolveProductPrice` pipeline. No price-display changes needed.

### 3. `src/pages/Index.tsx`
- Remove the `autoPrioritize` reorder block (the `.map/.sort/.map` chain). Sections render in the order admin set them.
- Pick the first enabled `promo_collection` section from `enabledSections` and render it in a fixed slot directly after the hero, before `MarketplaceFeed` (mobile) and before the desktop `sections.map`.
- In the desktop `sections.map` switch, skip `promo_collection` (already rendered above) so it doesn't double-render.
- On mobile, also render the promo slot before `MarketplaceFeed`. That places it above the chip scroll.

### 4. `src/components/admin/HomepageEditor.tsx`
- For `promo_collection` sections, expose: enable toggle (existing), title (existing `label`), subtitle, collection picker (existing `promoCollectionHandle`), limit, `autoPrioritize` (existing), `badgeLabel` (existing), plus new `showEmptyState` checkbox and `emptyStateMessage` text input.
- Keep reorder arrows working — but note in helper text that PROMOS always renders in the fixed slot above the category scroll regardless of its position in the list (until admins disable it).

## Notes
- No DB migration. All new fields live inside the existing `homepage_layout` JSON in `site_settings`.
- No changes to `pricing.ts`, `useActivePromotions`, `UnifiedProductCard`, or `MarketplaceFeed` internals.
- `matchCampaign` helper stays for badge/empty-state context passed into `PromoCollectionSection`.

## Files
- edit `src/hooks/useSiteSettings.ts`
- edit `src/components/home/PromoCollectionSection.tsx`
- edit `src/pages/Index.tsx`
- edit `src/components/admin/HomepageEditor.tsx`
