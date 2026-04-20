

## Why the product image disappears in the downloaded file

This is a confirmed, well-documented **iOS Safari bug in `html-to-image`** ([issue #461](https://github.com/bubkoo/html-to-image/issues/461)). The library renders the poster by serializing the DOM into an SVG `<foreignObject>` and rasterizing it. iOS Safari **silently drops `<img>` tags inside `foreignObject`** on the first render pass — text, backgrounds, and CSS render fine, but the hero image comes out as the empty black box you see.

The earlier prefetch-to-data-URL fix actually made this worse on iOS, because once the data URL is large (a 1024×1024 Shopify product photo base64-encoded is ~1.5 MB of inline payload), iOS Safari is even more likely to skip decoding it inside the foreignObject.

The current pipeline (waitForDomImages → swap to data URL → toJpeg) is correct for desktop and Android. It just hits this Safari bug.

### Fix: Two-layer hybrid capture (text via html-to-image, image via Canvas2D)

Render the poster as two passes and composite them:

1. **Pass 1 — html-to-image** captures the poster with the hero `<img>` made invisible (`visibility: hidden`). This produces a clean text/background/CTA layer that html-to-image handles reliably on every browser.
2. **Pass 2 — native Canvas2D** draws the prefetched hero image (already loaded as an `HTMLImageElement` from a data URL, so no CORS issue) into the exact rectangle the hero `<img>` occupies in the live DOM, using `getBoundingClientRect()` × pixelRatio.
3. Encode the composited canvas as JPEG → existing share / download flow.

This bypasses the foreignObject `<img>` bug entirely because the hero image is never inside the foreignObject — it's drawn natively by the browser.

### Safety net: retry + validation

- If on iOS Safari, run a **3-attempt loop** with a 200 ms delay between attempts. After each attempt, check the captured canvas hero region for >5% non-background pixels; retry if blank.
- Keep the existing >5KB blob size validation as a final guard.
- If after retries the hero is still blank, show a clear toast: `"Couldn't render product image — please try again"` and **abort** instead of saving a broken file.

### Files to change

- `src/pages/admin/MarketingStudio.tsx` — replace `handleExport` capture step with the two-layer hybrid renderer for single-product mode. Multi-product tile mode keeps the existing path (multiple small tiles are less affected) but gets the same retry-on-iOS guard.
- `src/lib/exportImageCache.ts` — add a small helper `loadImageElement(url)` that returns a fully-decoded `HTMLImageElement` for compositing, and `isIOSSafari()` for the retry guard.

### Verification

- iOS Safari (your phone): Download JPEG → opened file contains the Nike Shox hero photo, not a black box.
- Android Chrome: same.
- Desktop Chrome / Safari: same.
- Force-fail the prefetch (offline) → toast appears, no broken file is saved.

