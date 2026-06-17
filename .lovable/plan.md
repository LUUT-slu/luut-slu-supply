# Fix: posters must take their colour palette from the actual product

## Problem
Each style currently forces its own palette (default/hype = neon green, luxury = gold, bold = black/white/red, clean = white/charcoal). The overlay never sees the product's real colours, so the poster looks "off" and ignores what the listing actually is.

## Solution
Two changes inside `supabase/functions/generate-ai-poster/index.ts`:

### 1. Extract a real palette from the source product image
Before calling Flux/Ideogram, sample the product image and derive:
- `dominantColor` (main product colour)
- `secondaryColor` (next strongest hue)
- `accentColor` (a complementary highlight)
- `isLightProduct` / `isDarkProduct` flag (for choosing background contrast)

Implementation: fetch `sourceImageUrl` server-side, decode the PNG/JPEG with a lightweight Deno-compatible decoder (`https://deno.land/x/imagescript`), downscale to ~64×64, run a small k-means / bucketed-histogram pass in pure TS to pick the top 3 hex colours, ignoring near-white/near-black backdrop pixels around the edges.

Return them as `{ dominant, secondary, accent, isDark }`.

### 2. Rewrite `STYLE_PRESETS` to be palette-driven
Each preset becomes a *function* `(p: ProductPalette) => StylePreset` that interpolates the product's colours instead of hardcoded brand colours. Style now controls **mood, lighting, typography, layout**, not raw colour:

- **default** — LUUT layout (condensed uppercase, pill price chip, ribbon CTA). Background = darker shade of `p.dominant` (or pure black if product is light). Accent / chip / ribbon / brand wordmark all use `p.accent` (fallback to `p.dominant`). No forced neon green.
- **hype** — gritty concrete backdrop tinted toward `p.dominant`. Chip/ribbon use `p.accent`. Streetwear typography.
- **clean** — neutral off-white backdrop regardless of product. Text uses dark version of `p.dominant`; hairline accent uses `p.accent`. Minimal editorial.
- **luxury** — soft gradient backdrop built from a desaturated, warmed version of `p.dominant`. Accents in a metallic-tinted `p.accent`. Elegant serif typography. No forced gold.
- **bold** — high-contrast monochrome backdrop (black if product is light, white if product is dark). Single high-impact accent = `p.accent`. Brutalist scale. No forced red.

`paletteText`, `headlineColor`, `priceChip`, `ctaRibbon`, `brandText`, `sceneBackground` are all rewritten to reference `{dominant}`, `{secondary}`, `{accent}` hex values explicitly so Ideogram/Flux follow them.

### 3. Prompt updates
- `buildScenePrompt` adds: *"Backdrop colour family must come from this product palette: dominant `{hex}`, accent `{hex}`. Do not introduce colours outside this palette (no neon green, no gold, no red unless they are already in the palette)."*
- `buildOverlayPrompt` adds the same constraint and removes the blanket "do not add neon green" line in favour of: *"Use only the product-derived palette above. Do not introduce any colour that is not in {dominant, secondary, accent, neutral black/white}."*

### 4. Persist for debugging
Store the derived palette in `marketing_generated_images.style` as `${styleKey}|${dominant},${accent}|flux-kontext+ideogram` so we can verify after the fact.

## Files touched
- `supabase/functions/generate-ai-poster/index.ts` (only file)

## Out of scope
No UI changes, no aspect-ratio changes, no model swap, no change to the custom-image upload flow.
