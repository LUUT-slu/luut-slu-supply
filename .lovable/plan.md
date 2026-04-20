

## Performance & Speed Optimization Pass

A focused, high-impact pass on the biggest bottlenecks: hero LCP, product image weight, mobile rendering, and admin/Marketing Studio bundle bloat. No design or behavior changes.

### Diagnosed bottlenecks (highest impact first)

1. **Hero image is 1.7 MB** (`src/assets/storefront-hero.webp`) and forces `decoding="sync"` with `fetchPriority="high"` — blocks LCP on mobile.
2. **Product images request a fixed width** (300/400/600px) regardless of device DPR or actual rendered size — phones with DPR 3 get blurry or oversized images depending on context.
3. **No `srcSet`/`sizes`** on any `<img>` — browsers can't pick the right size; mobile downloads desktop-sized assets.
4. **All card images use `loading="lazy"`** including the first row above the fold — delays first paint of the trending grid.
5. **Supabase-hosted seller images are served raw** (no width transform) — full JPEG every time.
6. **Marketing Studio (1269 LOC) eagerly imports `html-to-image`** at module top → big chunk pulled even when admin opens any other tab.
7. **Vite has no `manualChunks`** — vendor code (radix, react-query, lucide, supabase) ships in one big chunk that blocks first paint.
8. **`WhatPeopleAreBuyingSection` re-shuffles products on every render** (no stable seed) and triggers extra layout work.
9. **`Header` makes 2 extra Supabase round-trips on every page load** to compute `portalLink` (admin role + seller profile).
10. **Hero `<section>` uses `min-h-[90vh]`** with a big background image — large LCP candidate area; can be served as a `<picture>` with mobile-specific source.

### Fixes — by priority

#### P1 — Homepage / LCP

- **Re-encode `storefront-hero.webp`** to a mobile (`-mobile.webp` ~640w, ~80 KB) and desktop (`~1600w`, ~250 KB) version. Keep PNG out of the bundle.
- Use `<picture>` in `Index.tsx`:
  ```tsx
  <picture>
    <source media="(max-width: 768px)" srcSet={heroMobile} />
    <img src={heroDesktop} fetchPriority="high" decoding="async" ... />
  </picture>
  ```
  Drop `decoding="sync"` (it blocks rendering).
- **Preload** the chosen hero in `index.html` with `<link rel="preload" as="image" imagesrcset=... imagesizes=...>`.

#### P2 — Product image delivery

- **Upgrade `getOptimizedImageUrl`** to:
  - Accept a `dpr` arg (default `window.devicePixelRatio`, capped at 2) and multiply width.
  - Add `&crop=center` for Shopify so server crops square thumbs (lighter than client-side `object-cover` of larger image).
  - Also handle `**brwnjlsdovqlkbtkhsye.supabase.co/storage/...**` URLs by appending Supabase Image Transformations: `?width=600&quality=75&resize=cover` (Storage supports render/image transforms). Falls back to original URL if not a recognized host.
- **Add `srcSet` + `sizes`** to product card images:
  ```tsx
  <img
    src={url(600)}
    srcSet={`${url(300)} 300w, ${url(600)} 600w, ${url(900)} 900w`}
    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
    loading={isAboveFold ? "eager" : "lazy"}
    decoding="async"
    fetchPriority={isAboveFold ? "high" : "auto"}
  />
  ```
- **Above-fold heuristic**: pass `priority` prop to `UnifiedProductCard` / `ProductCard`. First section on the homepage and first 4 cards in any grid get `loading="eager"` + `fetchPriority="high"`. Everything else stays lazy.
- **Mobile sizes**: keep the 112×112 mobile thumbnail at `url(224)` (2× DPR) instead of 300; that's a 30 % byte savings for the trending row.

#### P3 — Reduce JS work / bundle weight

- **Vite `build.rollupOptions.output.manualChunks`** split:
  - `react-vendor` → react, react-dom, react-router-dom
  - `radix` → all `@radix-ui/*`
  - `query` → `@tanstack/react-query`, `@supabase/supabase-js`
  - `icons` → `lucide-react`
  Result: smaller initial chunk, better long-term caching when product code changes.
- **Lazy-import `html-to-image`** inside `MarketingStudio.handleExport` (`const { toJpeg } = await import("html-to-image")`) — strips ~80 KB from the admin chunk until the user clicks Export.
- **Stabilize the trending shuffle**: seed `Math.random` with the current date so the order is stable per session; eliminates re-renders changing image order during hydration.
- **`Header` portal lookup**: combine the two queries into one RPC or run them in `Promise.all` and gate behind `requestIdleCallback` so they don't block first paint.

#### P4 — Caching / delivery

- Add `Cache-Control: public, max-age=31536000, immutable` hint via `<link>` preconnect/preload only — actual headers are CDN-controlled but `crossorigin` + `preconnect` already exist; add `preconnect` for the Supabase storage origin so the first product image isn't delayed by TLS.
- Keep React Query staleTime (already 5 min) — confirm it's applied to `useShopifyCollections` and `useSiteSettings`.

#### P5 — Marketing Studio specifics

- **Defer `html-to-image` import** (covered above).
- **Lazy-mount template previews**: only render the currently selected `MarketingTemplate`/`MultiProductTemplate`, not all of them. Confirm this is already the case; if hidden ones still mount, wrap in `{activeFormat === f.key && <Template ... />}`.
- **Throttle `useImagePrep`** AI calls with the existing cache (already done) — verify cache survives Tab switches by lifting the `Map` to module scope (already module-scoped).

### Files touched

- `vite.config.ts` — add `build.rollupOptions.output.manualChunks`.
- `index.html` — preload mobile vs desktop hero, add Supabase storage `preconnect` (already present — verify), drop blocking sync decoding.
- `src/lib/shopify.ts` — extend `getOptimizedImageUrl` (Shopify + Supabase Storage, DPR-aware, srcSet helper `getImageSrcSet(url)`).
- `src/assets/` — add `storefront-hero-mobile.webp` (640w) and `storefront-hero-desktop.webp` (1600w); remove unused `.png`.
- `src/pages/Index.tsx` — `<picture>` hero, `<img decoding="async">`, mark first trending section's first 4 cards as priority.
- `src/components/UnifiedProductCard.tsx` — accept optional `priority` prop, emit `srcSet`+`sizes`, mobile thumb 224w.
- `src/components/ProductCard.tsx` — same `srcSet`/`sizes` + `priority` prop.
- `src/components/HomeCategorySection.tsx`, `HomeNewArrivalsSection.tsx`, `HomeFeaturedSection.tsx`, `BestSellersSection.tsx`, `WhatPeopleAreBuyingSection.tsx` — pass `priority` to first 4 cards of the first enabled section only.
- `src/components/Header.tsx` — `Promise.all` portal lookup + `requestIdleCallback` gate.
- `src/pages/admin/MarketingStudio.tsx` — dynamic `import("html-to-image")` inside export handlers.

### Out of scope

- Server-side rendering / SSR.
- Switching off React Query.
- Replacing the Shopify Storefront API or moving images to a third-party CDN (e.g. Cloudflare Images).
- Refactoring the Marketing Studio architecture (only the bundle-import change).

### Verification

- Lighthouse mobile: LCP < 2.5 s on `/` (currently likely > 4 s due to 1.7 MB hero).
- Network tab on mobile viewport: hero image weight < 100 KB; first product images < 40 KB each.
- Trending grid: first 4 product images marked `priority`, request fires immediately, not on scroll.
- Build output: separate `react-vendor`, `radix`, `query`, `icons` chunks visible in `dist/assets`.
- Marketing Studio: `html-to-image` chunk fetched only after clicking Export (verify in Network tab).
- Header: only 1 batched call to Supabase on first load; runs after page idle.

