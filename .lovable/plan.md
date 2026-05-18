## Goal

Rebuild the mobile homepage to match the uploaded reference: cinematic hero slider, sticky translucent header with cart badge, "In Stock Now" with category pill filters, redesigned 2-up product cards, New Arrivals, fixed bottom nav, gold WhatsApp FAB. Keep current branding, Shopify sync, collections, and product data. Desktop stays functional — mobile is the priority.

## Scope

Frontend only. No backend, schema, or business-logic changes. Reuses existing hooks (`useHybridProducts`, `useShopifyCollections`, `useSiteSettings`, `useShopifyBestSellers`, cart store).

## Changes

### 1. New `MobileHeader` (mobile-only, sticky)
- Left: hamburger (opens existing Sheet drawer logic).
- Center: gold "LUUT SLU" wordmark.
- Right: cart icon + live count badge from `useCartStore`.
- Black/70 background + `backdrop-blur`, hairline gold border bottom.
- Render conditionally inside existing `Header.tsx` so desktop header is untouched.

### 2. New `HeroSlider` component
- Swipeable carousel of 3–4 banners (existing hero image first; remaining pulled from site-settings hero or static fallbacks).
- `embla-carousel-react` (already in repo via shadcn `carousel.tsx`) with autoplay + drag.
- Overlay gradient, bold heading, gold CTA pill, pagination dots.
- `aspect-[4/5]` on mobile, capped height on desktop.
- LCP image keeps `fetchPriority="high"`.

### 3. New `InStockNowSection`
- Header row: "IN STOCK NOW" + subtitle + gold "View All →".
- Horizontal scroll pill filter: All, Beanies & Tams, Hats, Footwear, Bags, Accessories (mapped to existing Shopify handles). Active pill = gold fill, inactive = outlined.
- Below: 2-col grid of `UnifiedProductCard` from `useHybridProducts` filtered by selected pill. Sold-out pushed last (already handled by `sortByStockStatus`).
- Replaces the first auto-rendered category section on mobile only.

### 4. `UnifiedProductCard` mobile polish
Card already matches most reference points. Small refinements:
- Add strikethrough `compareAtPrice` next to gold price when present.
- Always show rating + sold row when `soldCount` available (already wired).
- Tighter shadow + `ring-1 ring-white/5` for premium feel.
- No structural change — keeps Shopify/local data flow.

### 5. New `MobileBottomNav` (fixed, mobile-only)
- 5 tabs: Home `/`, Categories `/shop`, Orders `/my-orders`, Favourites `/account?tab=favourites`, Account `/account`.
- Active tab gold, others muted; `backdrop-blur` black background.
- Active state derived from `useLocation()`.
- Add `pb-20` spacing to homepage main so content isn't hidden under nav.

### 6. Floating WhatsApp button
- Reuse existing `ChatButton variant="floating"` — re-style to gold circular with subtle pulse; reposition above bottom nav on mobile (`bottom-24`).

### 7. `Index.tsx` updates
- Render `<HeroSlider />` instead of inline hero on mobile (desktop keeps current hero).
- Insert `<InStockNowSection />` as the first content section.
- Keep existing dynamic `sections.map(...)` for New Arrivals, Best Sellers, additional category sections.
- Add bottom padding for nav clearance; mount `<MobileBottomNav />` at the end.
- Lazy-load below-fold sections via `React.lazy` + `Suspense` to improve initial paint.

### 8. Performance
- Add `loading="lazy"` + `decoding="async"` everywhere not already set.
- `priority` only on the first 2 visible product cards.
- Hero images already use `<picture>` + WebP — keep.

## Files

**New**
- `src/components/home/MobileHeader.tsx`
- `src/components/home/HeroSlider.tsx`
- `src/components/home/InStockNowSection.tsx`
- `src/components/home/MobileBottomNav.tsx`

**Edited**
- `src/pages/Index.tsx` — wire new components, mobile/desktop split, lazy-loading, bottom padding.
- `src/components/Header.tsx` — render `MobileHeader` on mobile, keep desktop nav intact.
- `src/components/UnifiedProductCard.tsx` — minor mobile polish (compareAtPrice, ring).
- `src/components/ChatButton.tsx` — adjust floating position/style on mobile.

## Out of scope

- Wishlist persistence (heart stays visual-only as today).
- Admin homepage editor changes (existing dynamic sections still render).
- Category/sub pages, product detail, checkout — untouched.
- Auth and any backend tables.

## Risks

- Adding a fixed bottom nav can collide with existing floating chat/AI widgets — mitigated by repositioning `ChatButton` and `AIChatWidget` above the nav on mobile.
- Embla autoplay can hurt LCP if it cycles before image paints — autoplay starts after 4 s and the first slide uses the existing preloaded hero image.
