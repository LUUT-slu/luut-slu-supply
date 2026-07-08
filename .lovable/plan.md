## Step 0 — Inventory (from `src/pages/admin/marketing-studio/DisplayTab.tsx`)

- **Shopify products & variants**: `useHybridProducts({ limit: 100 })` → `products[]`. Local `selectedId` / `selectedVariantId` derive `product` and `variant`. Variants from `product.variants[]`.
- **Reference image ("Auto" listing image)**: `variantImage = variant?.image?.url || product?.images?.[0]?.url`. When `refs[]` is empty, `variantImage` is auto-used inside `generate()`.
- **Prompt compiler**: `previewDisplayFinal(controls, brandStyle)` in `src/lib/marketingRouting.ts` (wraps `buildDisplayPrompt`). `controls` built from `goal/style/background/realism/focus/aspect/notes/hasReference/productTitle/productCategory`. Edits handled in `PromptPreview` via `promptOverride`.
- **Generate call**: `supabase.functions.invoke("ai-image-prep", { body: { imageUrl, mode, aspectRatio, campaignType: "display", productTitle, prompt: promptOverride ?? prompt } })`. `mode = background === "transparent" ? "remove-bg" : "expand"`. Seed via `lastSeed`; result → `resultUrl`.

All four stay wired exactly as-is.

## Restyle plan (visual only)

**Scope**: only `src/pages/admin/marketing-studio/DisplayTab.tsx` and a light restyle of `src/pages/admin/marketing-studio/PromptPreview.tsx`. No changes to `marketingRouting.ts`, `useHybridProducts`, `ai-image-prep`, `MarketingStudio.tsx` shell, Poster/Video/Library tabs, routing, or auth.

### Tokens (scoped inline to Display tab; no global theme edits)
bg `#0B0A0D`, card `#161419`, raised `#211E26`, border `#2C2833`, text `#B4AEBE`, white for emphasis, gold `#E0A82E`, gold-2 `#F5C451`, active fill `#E0A82E14`, CTA gradient `linear-gradient(135deg,#E0A82E,#F5C451)` with soft gold glow.

### Layout (top → bottom, mobile-first; `lg:` keeps right rail for Live Preview / Result)

1. **Product Source** — new segmented toggle `sourceMode: 'shopify' | 'upload' | 'none'`.
   - `shopify`: card with thumb + "SHOPIFY PRODUCT" gold eyebrow + name + current variant + "Change" button (reopens the existing `<select>`). Variant pills rendered **only if** `product.variants.length > 1`; drives the same `selectedVariantId`. Auto reference flow unchanged.
   - `upload`: reuses `prepareMarketingSourceImages` → writes into `refs[0]`; shows thumb + Replace.
   - `none`: dashed card. `hasReference` = `refs.length > 0 || (sourceMode === 'shopify' && !!variantImage)`; `productTitle` empty when `none`. Compiler untouched — only its inputs change.

2. **Describe your image** — a single textarea bound to the existing `notes` state (renamed section, replaces the old "Additional Notes" card entirely per option A). Includes a gold "Auto prompt" chip that focuses the field.

3. **Reference This Image** — relocates the existing `Reference Images (0/4)` card + Auto thumb here. Copy updated verbatim: "Use this image to create the structure of how the image will look, do not copy any contents inside." Same `refs` state, `MAX_REFS=4`, same upload handler.

4. **Quick Presets** — existing `DISPLAY_PRESETS` as horizontal-scroll gold pills. Same `applyPreset`.

5. **Visual picker rows** (horizontal scroll, cards = swatch tile + label; selected = gold border + `#E0A82E14`):
   Display Goal · Style · Background · Realism · Product Focus — same option arrays and setters. Background swatch tiles get hinted previews (transparent = checkerboard, studio = grey soft gradient, gradient = warm gradient, lifestyle = scene gradient, solid = flat tint).

6. **Choose Shape (Aspect Ratio)** — cards with a mini rectangle in true proportion per `ASPECTS` entry. Same `aspect` state.

7. **Final Prompt** — pass-through to existing `PromptPreview`, restyled dark. Compile logic, override state, Edit/Reset/Copy behavior, and 8 ADD TO PROMPT chips unchanged.

8. **Live Preview** — existing `LayoutPreview` inside restyled card with small tag chips summarizing selections.

9. **Result** — existing `resultUrl` render inside restyled dashed placeholder.

10. **Sticky Generate bar** — full-width gold-gradient "Generate Display Image" + "Regenerate Same Image" underneath. Same `generate()` calls, same seed logic. `sticky bottom-0` with blurred dark backdrop on mobile.

### What stays exactly the same
`useHybridProducts`, product/variant state, `controls` shape and `previewDisplayFinal` call, `refs` + `prepareMarketingSourceImages` + `MAX_REFS`, `PromptPreview` compile/override behavior, `supabase.functions.invoke("ai-image-prep", …)` payload, `lastSeed`/`resultUrl`/`downloadImage`, toast messages, Marketing Studio shell (Header, AdminGroupNav, Admin back, Brand Style, Credits & Status, task tabs).

### Files touched
- `src/pages/admin/marketing-studio/DisplayTab.tsx` — full JSX restyle + `sourceMode` local state + local `VisualPickCard` component.
- `src/pages/admin/marketing-studio/PromptPreview.tsx` — restyle only (dark card, gold accents, chip pills). Logic unchanged.

No other files touched.