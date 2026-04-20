
## Fix: Exported poster missing product image on mobile

### Root cause
`toPng(exportRef, { cacheBust: true })` appends a `?t=...` query param to every `<img src>` URL during capture. On mobile (especially iOS Safari), this triggers a fresh fetch of the Shopify CDN image **without** the cached CORS preflight response — the canvas then sees a tainted/incomplete image and silently drops it. Result: background, text, and CTA render fine, but the hero `<img>` (Shopify CDN) is missing from the saved PNG.

The same issue affects: hero product image, brand logo URL, multi-product tile images, and variant images.

### Fix strategy
**Pre-resolve every external image to a data URL before `toPng()` runs**, so html-to-image never has to re-fetch anything. This guarantees preview = export, on mobile and desktop.

### Changes

**1. New helper: `src/lib/exportImageCache.ts`**
- `prefetchImagesAsDataUrls(urls: string[])` — fetches each URL via `fetch()` (CORS-friendly, browser handles preflight once) and converts the blob to a base64 `data:` URL.
- Returns a `Map<originalUrl, dataUrl>` to pass into `html-to-image` as `imagePlaceholders`, which is the supported way to substitute external `<img src>` values during capture without mutating the live DOM.
- Skips URLs that are already `data:` or `blob:`.
- Throws a clear error if any required image fails (so we can show a toast instead of saving a broken poster).

**2. `src/pages/admin/MarketingStudio.tsx` — `handleExport`**
- Before calling `toPng`:
  1. Collect every external image URL referenced in the current export node:
     - `productPayload.productImage` (single mode, after `singlePrep.preparedUrl`)
     - `variantImages[].url` (single multi-variant mode)
     - `multiTemplateProps.products[].imageUrl` (multi mode, after tile prep)
     - `brandLogoUrl` if present
  2. Wait for all `<img>` elements inside `exportRef.current` to be `complete` and call `decode()` on each — guarantees the browser has fully loaded them in the live DOM (preview ↔ export consistency).
  3. Call `prefetchImagesAsDataUrls(urls)` → get `Map`.
  4. Pass result to `toPng` via `imagePlaceholders` option.
- **Disable `cacheBust`** (it's the trigger). With placeholders prefilled, cache-busting is unnecessary.
- Increase `toPng` timeout (`fetchRequestInit` removed, set `imageTimeout` via wrapper).
- If prefetch throws, show toast `"Couldn't load product image — try again in a moment"` and abort export — never save a broken poster.

**3. Export button gating**
- Disable the "Save / Share" / "Download PNG" button while the hero/tile images are still loading. Track readiness via a small `useImagesReady(urls)` hook that resolves only when every URL responds with a successful `HEAD`/`fetch`.
- Button shows "Loading image…" state until ready.

**4. Files**
- `src/lib/exportImageCache.ts` *(new)* — prefetch helper + `useImagesReady` hook
- `src/pages/admin/MarketingStudio.tsx` — wire prefetch into `handleExport`, gate the button, drop `cacheBust`

### Verification
- Desktop: download Single Promo, Multi Bestsellers, and Promotion posters → product image present.
- Mobile (iOS Safari + Android Chrome):
  - Preview shows hero image
  - Tap Save / Share → native sheet opens with file
  - Save to Photos → opened image contains product photo (matches preview)
- Force a CORS failure (replace hero with a non-CORS URL) → toast appears, no broken file saved.
- Multi-tile poster: every tile image present in saved PNG.
