

## Apply iOS hybrid hero capture to all poster types

### Current state
The hybrid Canvas2D capture (which fixes the iOS Safari `<foreignObject><img>` bug) only runs reliably for templates whose hero images carry `data-export-hero="true"`. Multi-product / variant tiles in some templates don't have the marker, so on iOS Safari those tiles export as black boxes.

### What I'll do

1. **Audit `src/components/marketing/templates.tsx`** and add `data-export-hero="true"` + `data-export-src={imageUrl}` to every product `<img>` across:
   - Single Promo (Story / Post / Portrait / Ad)
   - Multi Bestsellers tiles
   - New Arrivals tiles
   - Promotion / sale poster hero
   - Any variant-strip thumbnails that should appear in export

2. **Generalize the hero collection step in `handleExport`** (`src/pages/admin/MarketingStudio.tsx`):
   - Query `[data-export-hero="true"]` (already does this) — confirm it picks up every tile
   - For each, capture `getBoundingClientRect()` + resolved `object-fit` + crop state, then composite onto the canvas with `cropToSourceRect`
   - Run the same iOS retry/validation loop (3 attempts, pixel-sample check) per tile, not just the first hero

3. **Apply crop-state transform** during native compositing for every tile (multi-product posters currently only honor crop on the primary hero).

4. **Validation guard**: if any tile fails the pixel-sample check after 3 retries → abort with toast `"Couldn't render one of the product images — please try again"`. No partial / broken file saved.

### Files
- `src/components/marketing/templates.tsx` — add export markers to every product `<img>`
- `src/pages/admin/MarketingStudio.tsx` — loop hybrid composite over all hero rects, per-tile retry guard

### Verification
- iOS Safari: export Story, Post, Portrait, Ad, Multi Bestsellers, New Arrivals, Promotion → every product photo present.
- Android Chrome + Desktop: unchanged, still pixel-perfect.
- Manual crop edits applied to tile #2 of a multi-product poster appear in the exported JPEG.

