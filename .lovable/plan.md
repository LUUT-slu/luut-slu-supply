

## Fix: product-aware framing (no stretch, smart grids, story-balanced)

### Root causes
1. **Hero `<img>` uses `objectFit: "cover"`** — even after smart prep, the browser re-crops to the hero container's aspect ratio. The product gets clipped in story format.
2. **`autoFitProduct` / `smartReframe` bake in the poster aspect** — they output 9:16 / 1:1 / 4:5 canvases. But the live hero container is its own aspect (≈3:4 in story). So a story-prepped image is squashed/cropped a second time on render.
3. **Multi-image (variant grid) stacks 3 items as 1-on-top + 2-below in story** — that "spanFull" row makes the layout too tall and unbalanced. Current grid math is generic, not story-aware.
4. **Story layout has no max hero height** — when long product names + tagline + price + pills appear, hero squeezes; when they're short, hero takes 70% and layout looks empty at the bottom.

### Fix strategy — product-aware framing layer

#### A. New helper: `src/lib/imageFraming.ts`
- `frameProduct(url, containerAspect)` — pure-canvas:
  1. Detect content bounds (reuse existing pixel-scan logic).
  2. Compute the smallest canvas that **matches the container aspect** AND contains the bounded subject + 12% margin all sides.
  3. Center subject; fill background with sampled corner color.
  4. Output PNG sized to fit the live hero container (so `objectFit: "contain"` displays 1:1, no further crop).
- This replaces both `autoFitProduct` (when targeting a specific container) and `smartReframe` for the live preview pipeline. The poster-aspect versions stay for full-bleed exports.

#### B. Container aspect awareness
- `useImagePrep` gains a second arg: `containerAspect?: number`. When provided (single-product PresetLayout passes the live hero box aspect), prep functions frame for **that** aspect, not the poster aspect. Result: the hero `<img>` can use `objectFit: "contain"` with no further cropping — preview = export, pixel-perfect.

#### C. Hero rendering switch
- `PresetLayout` hero `<img>`: change `objectFit: "cover"` → `objectFit: "contain"` (with a sampled background fill behind it). The framing helper has already cropped/padded to the right aspect, so `contain` shows it 1:1.
- `MultiProductTemplate` tiles: keep `objectFit: "contain"` with each tile's prepared image framed to the tile aspect.

#### D. Story-balanced layout
- Cap hero region in story format at **`maxHeight: 56%`** of the poster (currently `flex: 1` lets it grow unbounded). Reserve guaranteed space for headline (12%), price + pills (12%), CTA (10%), brand line (4%), plus padding.
- For `post`/`portrait`/`ad`, keep current `flex: 1` (already balanced).

#### E. Multi-image (variant) grid rules
Replace generic 1+2 split in `PresetVariantGrid` with explicit story-safe rules:
- 1 image → single tile
- 2 images → side-by-side `1fr 1fr`, single row (current — keep)
- 3 images → **side-by-side `1fr 1fr 1fr` single row** in story/portrait (no full-span tile that doubles height); 2x2 with empty 4th slot only in `post`/`ad`
- 4 images → 2x2 grid (current — keep)
- Each tile uses `objectFit: "contain"` on a sampled background — never stretch, never crop product.

Same rules apply to `ProductGrid` (multi-product mode) tiles.

#### F. Mode mapping (per the spec)
- "Auto Fit" → calls `frameProduct(url, containerAspect)` — center + scale, no stretch, sampled bg fill.
- "Smart Reframe" → uses `smartReframe` but clamped to subject + 8% padding (already correct, just needs `objectFit: contain` to prevent re-crop).
- "Expand" → AI edge function (existing) — outpaints background, never alters product. Keep as-is.

### Files to change
- `src/lib/imageFraming.ts` *(new)* — `frameProduct(url, containerAspect)` + shared `detectContentBounds`/`sampleCornerColor` extracted from `imagePrep.ts`.
- `src/lib/imagePrep.ts` — refactor to consume the shared helpers; keep poster-aspect versions for full-bleed exports.
- `src/hooks/useImagePrep.ts` — accept optional `containerAspect`; cache key includes it; route "auto-fit" through `frameProduct`.
- `src/components/marketing/templates.tsx`:
  - `PresetLayout` hero `<img>`: `objectFit: contain`, sampled bg fill, story `maxHeight: 56%`.
  - `PresetVariantGrid`: new story/portrait grid rules (3 = three columns, no spanFull); tile `<img>` → `contain`.
  - `ProductGrid`: same tile `contain` change for multi-product mode.
- `src/pages/admin/MarketingStudio.tsx` — measure hero container aspect via `getBoundingClientRect` and pass to `useImagePrep`. Re-prep on format change (cache already keyed on format).

### Verification
- Story poster, single product: product fully visible, centered, no stretch; layout has room for headline + price + CTA below; hero ≤ 56% poster height.
- Story poster, 3 variants: three side-by-side tiles in a single row, each with full product visible (contain, not cover).
- Post / portrait / ad: same product fits cleanly, no awkward crop.
- Export PNG matches preview pixel-for-pixel (contain + pre-framed image = identical render).
- Switching format re-frames automatically (cache miss on aspect change).

