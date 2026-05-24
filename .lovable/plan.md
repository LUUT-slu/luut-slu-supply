## Goal

Make `/` use one shared, responsive homepage on every screen. Mobile already shows: HeroSlider → PROMOS → MarketplaceFeed (Shopify pills + product grid). Desktop currently shows a static hero and the admin's dynamic sections, with no MarketplaceFeed and PROMOS only appearing if a section is configured. The two should be the same component tree, just styled responsively.

## Target homepage order (both mobile and desktop)

```text
┌─────────────────────────────────────┐
│ Header                              │
│ HeroSlider (cinematic, responsive)  │
│ PROMOS (pinned, auto-scan)          │
│ MarketplaceFeed (pills + grid)      │
│ Admin sections (Best/Featured/etc.) │
│ HomepageReviews                     │
│ Trust + How It Works + CTA          │
│ Footer / MobileBottomNav            │
└─────────────────────────────────────┘
```

## Changes

### 1. `src/pages/Index.tsx` — single render tree
- Remove the `isMobile` branch around the hero. Always render `<HeroSlider />`.
- Delete the desktop-only `<section className="relative min-h-[90vh]…">` block and its `picture`/CTA markup (HeroSlider already reads the same `hero` settings, so admin hero config keeps working).
- Always render the pinned `PromoCollectionSection` (current logic stays).
- Always render `<MarketplaceFeed />` after PROMOS, on both viewports.
- Always render the admin `sections.map(...)` loop after MarketplaceFeed (currently desktop-only). This is the answer to the second question — sections render on mobile and desktop.
- Keep `pb-20` only on mobile (for MobileBottomNav clearance).

### 2. `src/components/home/HeroSlider.tsx` — responsive scale-up
- Adjust slide container so it grows on larger viewports: `h-[70vh] sm:h-[75vh] md:h-[85vh] lg:h-[90vh]` (currently fixed mobile-ish height).
- Use `<picture>` with `storefrontHeroDesktop` for `md+` and `storefrontHeroMobile` below, both falling back to `hero.imageUrl` when set.
- Scale typography and CTAs at `md:`/`lg:` (e.g. heading `text-3xl md:text-5xl lg:text-6xl`, wider max-width on the text block, larger button sizing).
- Keep autoplay + Embla logic unchanged. No new animations (respects the static-hero perf memory: scale only, no extra motion).

### 3. `src/components/home/MarketplaceFeed.tsx` — desktop polish
- Section padding scales: `py-5 md:py-10`.
- Grid already responsive (`md:grid-cols-3 lg:grid-cols-4`); bump to `xl:grid-cols-5` for very wide screens.
- Pills row: keep horizontal scroll on mobile, allow `md:flex-wrap` so all chips show on desktop without scroll.
- Raise `limit` from 40 → 48 to better fill desktop grids.

### 4. `src/components/home/PromoCollectionSection.tsx` — responsive grid only
- No logic changes. Ensure its product grid uses the same responsive classes as MarketplaceFeed (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`) so the pinned PROMOS slot looks consistent on desktop. Header countdown + auto-scan stay as-is.

### 5. Admin homepage sections — render on both viewports
- The `sections.map(...)` block moves out of the `isMobile ? … : …` branch in `Index.tsx` and runs unconditionally below MarketplaceFeed. Existing components (`BestSellersSection`, `HomeFeaturedSection`, `HomeCategorySection`, `HomeNewArrivalsSection`, `WhatPeopleAreBuyingSection`) are already responsive, so no changes inside them.
- `promo_collection` continues to be skipped here (rendered in the pinned slot).

### 6. No changes
- `useSiteSettings`, `HomepageEditor`, `usePromotionCampaigns`, pricing logic, DB schema, edge functions: all untouched. The admin's existing homepage section controls now drive desktop AND mobile through the unified tree.

## Files touched

- `src/pages/Index.tsx` — restructure render tree, remove desktop-only hero, render MarketplaceFeed + sections on both viewports.
- `src/components/home/HeroSlider.tsx` — responsive sizing + desktop image source.
- `src/components/home/MarketplaceFeed.tsx` — responsive padding, pill wrap on desktop, xl grid, limit bump.
- `src/components/home/PromoCollectionSection.tsx` — responsive grid columns only.

## Out of scope

- Visual redesign of any section.
- Changes to admin Homepage Editor schema or controls.
- PROMOS auto-scan logic (already shipped in the previous turn).
- Header / MobileBottomNav.
