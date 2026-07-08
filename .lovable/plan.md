## Goal
In the Display tab, the image chosen in **Product Source** should always be the true product image sent to generation, so the product renders exactly as it looks. The **Reference This Image** section becomes a separate, purely optional "how it should look" style board — never mixed with the product image.

## Changes (DisplayTab.tsx only — visual + local state, no backend/logic changes)

### 1. Product Source owns the product image
- Add local state `uploadedProductUrl: string | null` for the "My Own Image" mode, independent of `refs`.
  - Upload UI writes to `uploadedProductUrl` (not into `refs` as it does today).
- Derive a single `productImageUrl`:
  - `shopify` → `variantImage` (variant image, falling back to product's first image — unchanged).
  - `upload` → `uploadedProductUrl`.
  - `none` → `null`.
- Product Source card copy gets a small helper line: "This image is used as the product. It defines exactly how the product looks in the result."

### 2. Reference section becomes style-only
- Remove the auto-attached AUTO variant thumbnail, the `autoRefDismissed` state, and the "Restore auto" button. `refs` now only ever contains images the user explicitly uploaded here.
- Retitle: **"Style Reference (optional)"** with count `{refs.length}/{MAX_REFS}`.
- Helper copy: "Optional. Shows how you'd like the final image to look and feel — mood, lighting, composition. The product itself is taken from Product Source above."

### 3. Generation wiring
- `generate()` uses `productImageUrl` as the single `imageUrl` sent to `ai-image-prep` (same call, same fields — unchanged endpoint/body shape).
  - Shopify with variant selected → variant image goes to the model (this fixes the "exact product" concern).
  - Upload mode → uploaded image goes to the model.
  - None mode or no product image → existing `text-to-image` fallback path (unchanged).
- `hasReference` in `controls` becomes `!!productImageUrl` (keeps the prompt compiler behaving the same as today when a product image is present).
- Style refs in the Reference section are **not** injected into the edge function call in this pass (backend contract stays untouched per your "don't change logic" rule). They remain a visible style board for the operator. If you want them fed to the model too, that's a follow-up that requires an edge-function change.

### 4. Validation / errors
- Shopify mode with no product → existing "Select a product first" toast.
- Upload mode with no upload and empty prompt → toast "Upload a product image or write a prompt first".
- None mode with empty prompt → existing "Add a reference image or write a prompt first" copy updated to "Write a prompt first".

## Untouched
- `previewDisplayFinal`, `DISPLAY_PRESETS`, prompt compiler.
- `ai-image-prep` and `text-to-image` edge functions (bodies, headers, polling).
- `useHybridProducts`, variant selection logic, `prepareMarketingSourceImages`.
- `PromptPreview`, `LayoutPreview`, sticky Generate bar, Marketing Studio shell.
- Poster, Video, Library tabs, routing, auth.

## Files
- `src/pages/admin/marketing-studio/DisplayTab.tsx` (only)
