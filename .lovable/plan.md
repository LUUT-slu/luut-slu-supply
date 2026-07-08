## Goal

Redesign `PosterTab.tsx` to match the dark image-gen aesthetic used in `DisplayTab.tsx` and the uploaded reference (`luut-poster-v2.jsx`), while keeping the same split we just applied on Display: **Product Source** is the authoritative product image, **Reference Image** is a purely optional style board. Backend calls, prompt compiler, and edge functions stay untouched.

## Changes (PosterTab.tsx only)

### 1. Visual shell (match DisplayTab / uploaded design)
- Wrap the tab in the dark canvas: `INK`/`CARD`/`RAISED`/`LINE` tokens + `GOLD` accents, same as DisplayTab.
- Reuse the same primitives (`SectionCard`, `HScroll`, `GoldPill`, `VisualPickCard`) locally in this file so both tabs share aesthetic without a shared module change.
- Two-column grid on `lg`, single column on mobile, sticky right rail with Live Preview + Result.
- Sticky bottom Generate bar with gold gradient primary + secondary "Regenerate Same Poster (seed …)" — same styling as DisplayTab.
- Card corners, borders, chip styling, aspect thumbnail picker (mini rectangles per ratio) all mirror the uploaded reference.

### 2. Product Source card (new — replaces current bare `<select>`)
- `sourceMode: "shopify" | "upload" | "none"` segmented control at top.
- **Shopify**: shows thumbnail + title + selected variant, Change button opens picker `<select>` inline. Variants section always renders when the product has ≥1 variant (pills; single variant shown non-interactive with "Only one variant available. Add more in Shopify to pick a specific one here.").
- **Upload**: dark dashed uploader; sets `uploadedProductUrl` (independent from refs). Copy: "This image defines exactly how the product looks."
- **None**: dashed empty state, "Generate purely from your prompt and settings below."
- Helper line under the segmented control: "This image is used as the product. It defines exactly how the product looks in the result."
- Derived `productImageUrl`: shopify → `variantImage`, upload → `uploadedProductUrl`, none → `null`.

### 3. Style Reference card (optional, style-only)
- Retitled **"Style Reference (0/4) · optional"**.
- Uploader chips exactly like DisplayTab. `refs` only ever contains user-uploaded images — no AUTO variant thumbnail, no auto-fallback into `sourceRefs`.
- Helper: "Optional. Shows how you'd like the final image to look and feel — mood, lighting, composition. The product itself is always taken from Product Source above."

### 4. Controls redesign (same options, dark styling)
- Quick Presets → horizontal `GoldPill` row from `POSTER_PRESETS`.
- Campaign Type / Style / Realism → `VisualPickCard` horizontal scrollers (or grid) matching DisplayTab treatment.
- Aspect Ratio → mini-rectangle "Choose Shape" picker identical to DisplayTab.
- Text on Image card (Headline, Subheadline, Price, CTA, Additional notes) restyled with dark inputs, no behavior change.

### 5. Generate wiring (logic parity with Display)
- `productImageUrl` is the single image sent to the poster edge function:
  - If `productImageUrl` exists → call `poster-img2img-gpt` with `imageUrl: productImageUrl` (unchanged body shape, unchanged endpoint).
  - If null (`none` mode or upload with nothing yet) → existing `marketing-generate` text-to-image path, unchanged.
- Style refs (`refs`) are NOT sent to the edge function in this pass (backend contract stays as-is), matching the Display behavior we already shipped.
- `controls.hasReference` becomes `!!productImageUrl`.
- Validation:
  - Shopify + no product → "Select a product first".
  - Upload + no upload and empty prompt → "Upload a product image or write a prompt first".
  - None + empty prompt → "Write a prompt first".

### 6. Right rail
- `LayoutPreview` fed with `productImage={productImageUrl}` (so the mockup reflects the exact product image, including uploaded ones).
- Result card + Download button restyled to dark card, same as DisplayTab.

## Untouched

- `previewPosterFinal`, `POSTER_PRESETS`, prompt compiler.
- Edge functions `poster-img2img-gpt`, `marketing-generate`, `text-to-image` (bodies, headers, polling).
- `useHybridProducts`, `prepareMarketingSourceImages`, `getBrandStyleReferenceImage`.
- `PromptPreview`, `LayoutPreview`, Marketing Studio shell, other tabs.
- The `TextToImageSection` block rendered under the tab stays as-is (this pass only redesigns the primary Poster generator).

## Files

- `src/pages/admin/marketing-studio/PosterTab.tsx` (only)
