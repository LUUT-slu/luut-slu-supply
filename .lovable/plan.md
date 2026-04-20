

## Variant-Aware Marketing Studio

Add a "Select Variants" panel between the product picker and the format tabs. The poster preview reacts in real time to single/multi selection.

### What gets built

**1. Variant Selector component** — `src/components/marketing/VariantSelector.tsx`
- Reads `selectedProduct.variants[]` (already on `UnifiedProduct`)
- Mode toggle: **Single Variant** / **Multi-Variant**
- Renders each variant as a tappable card: square thumbnail (variant `image.url` → fallback to `images[0].url`) + variant label (built from `selectedOptions` like "Black" / "Black · M" — falls back to `title`)
- Single mode → radio behavior, one selection
- Multi mode → toggle behavior, checkmark + ring on selected
- Hidden entirely when product has only 1 default variant (e.g. local seller products) — falls back to current single-image flow
- Mobile-friendly grid: `grid-cols-3 sm:grid-cols-4 md:grid-cols-5` with tap-friendly squares

**2. Multi-variant template support** — extend `src/components/marketing/templates.tsx`
- New optional prop `variantImages?: { url: string; label?: string }[]` on `MarketingTemplate`
- When `variantImages.length > 1`, the main image area renders a smart grid instead of a single image:
  - 2 → side-by-side (1×2 or 2×1 depending on format orientation)
  - 3 → 1 large + 2 small OR 3 stacked depending on format
  - 4+ → 2×2 grid (caps at 4 to keep clean; more shows "+N")
- Optional small variant labels rendered under each tile (toggleable)
- Single image path unchanged when `variantImages.length <= 1` — zero visual regression
- Works across all 4 formats (Story, Post, Ad, Portrait) and all 3 styles (Clean, Hype, Minimal)

**3. MarketingStudio wiring** — `src/pages/admin/MarketingStudio.tsx`
- New state: `variantMode: "single" | "multi"`, `selectedVariantIds: string[]`, `showVariantLabels: boolean`
- Reset selection when product changes; default to first available variant
- Compute `variantImages` from selected variants → pass to `MarketingTemplate`
- In single mode the chosen variant's image overrides `productImage`
- Add a small "Show variant labels" switch in the Style & Branding card (multi mode only)
- Both preview node and hidden export node use the same `templateProps` → downloaded PNG matches preview exactly

### Files

**New**
- `src/components/marketing/VariantSelector.tsx`

**Edited**
- `src/components/marketing/templates.tsx` — add `variantImages` prop + grid renderer in image area for all 3 layouts
- `src/pages/admin/MarketingStudio.tsx` — selector state, variant section UI, pass props to template

### Out of scope
- Editing variant images / re-uploading
- Per-variant pricing display (still uses product price)
- Carousel export (one PNG with combined layout, not a multi-image zip)
- Dragging to reorder variants in the poster

