
## Goal
For the Poster tab only, replace the single-prompt Replicate call with a two-stage pipeline:
1. **Stage 1 — Background (Gemini):** generates a clean, text-free cinematic product scene from the product reference image.
2. **Stage 2 — Text overlay (Ideogram v3 Turbo, `style_type: "DESIGN"`):** takes Stage 1's image as the base and stamps the typography (product name, EC$ price, "DM to Buy", locations line, "LUUT SLU").

Display tab, Video, UI, presets, controls, Library, Lightbox, Live Preview, Download — unchanged.

## Changes

### 1. `src/lib/marketingRouting.ts`
Add two new builders next to the existing `buildPosterPrompt`:

- `buildPosterBackgroundPrompt(c, brand)` — visual scene only. Includes product identity-preserve clause, brand-style mood (palette/lighting/atmosphere), realism, style. Hard constraints: **deep black studio background, premium dramatic lighting, product sharp and centered, NO text, NO typography, NO logos, NO overlays, NO watermarks, NO captions**.
- `buildPosterTextPrompt(c)` — typography overlay brief. Lists exact text blocks in render order with hierarchy:
  - Headline: product name (from `controls.productTitle`)
  - Price: `EC$<n>` (from `priceText` / product price)
  - CTA: `DM to Buy`
  - Locations: `Castries · Gros Islet · Vieux Fort`
  - Footer wordmark: `LUUT SLU`
  - Style cues: bold clean sans-serif, strong hierarchy, high-contrast over the supplied base image, no background regeneration, preserve the underlying image, place text in negative-space regions.

Export a helper `previewPosterTwoStage(controls, brand)` returning `{ backgroundPrompt, textPrompt }` so `PromptPreview` and the regenerate flow can still show/edit prompts (a single combined view for the editor, or two collapsible panels — see UI note below).

### 2. `supabase/functions/marketing-generate/index.ts`
Add a poster two-stage branch. Detection: when `task === "poster"` and the body includes `backgroundPrompt` + `textPrompt`, run the pipeline; otherwise fall back to current single-call behavior (keeps Display + legacy callers intact).

Pipeline:
1. Normalize product refs (existing `normalizeRef` flow).
2. **Stage 1 — Gemini** via Lovable AI Gateway (`LOVABLE_API_KEY`, model `google/gemini-3-pro-image-preview` — Nano Banana Pro; falls back to `google/gemini-2.5-flash-image` if Pro fails). Input: `backgroundPrompt` + product reference image(s). Extract returned image bytes, upload to `marketing-assets` bucket, create signed URL (`geminiBaseUrl`).
3. **Stage 2 — Ideogram v3 Turbo** via Replicate model `ideogram-ai/ideogram-v3-turbo`. Input:
   ```
   {
     prompt: textPrompt,
     aspect_ratio: aspect,
     style_type: "DESIGN",
     magic_prompt_option: "Off",
     image: geminiBaseUrl,          // base for overlay
     style_reference_images: [geminiBaseUrl]
   }
   ```
   Pass the seed through to Ideogram for reproducibility.
4. Persist the final Ideogram image to `marketing-assets` (existing code path), insert a `marketing_generated_images` row with `model_used = "gemini→ideogram-v3-turbo"` and `prompt_used = textPrompt` (store `backgroundPrompt` in a notes/meta field if convenient; otherwise concatenate in `prompt_used`).

Error handling: keep existing friendly messages; if Stage 1 fails, abort before Stage 2 and surface a "Background generation failed" message. If Stage 2 fails, return the Gemini image as a fallback would be misleading — instead surface the Stage 2 error.

### 3. `src/pages/admin/marketing-studio/PosterTab.tsx`
- Replace `previewPosterFinal` call with `previewPosterTwoStage`; keep `route.model` ignored for poster (server picks the two-stage path).
- In `generate()`, send `backgroundPrompt` + `textPrompt` in the body instead of the single `prompt`. Keep `prompt` field set to the text prompt for backwards-compatible logging.
- `PromptPreview` shows the **text** prompt as the editable field (it's what controls the visible poster output), with a read-only collapsible "Background prompt" section above it. `promptOverride` continues to override only the text prompt.
- Seed reuse, Regenerate Same Poster, Download, Live Preview — unchanged.

### 4. `src/pages/admin/marketing-studio/PromptPreview.tsx`
Add an optional `secondaryPrompt?: { label: string; value: string }` prop. When present, render it as a read-only collapsed block above the existing editor. Existing call sites (Display tab) unaffected.

## Out of scope
- Display tab generation path
- Video module
- UI layout, presets, controls, BrandStyle selector
- Library, Lightbox, download behavior

## Technical notes
- Lovable AI Gateway endpoint for image gen: `https://ai.gateway.lovable.dev/v1/...` using `LOVABLE_API_KEY` (already in secrets). Response format follows the standard Gemini image response — extract base64 inline data, decode, upload as PNG.
- Ideogram v3 Turbo on Replicate accepts `image` (base image) plus `style_type` per Replicate's schema; we pass the Gemini signed URL.
- Existing `runReplicate` helper is reused for Stage 2; a new `runGeminiImage(prompt, refUrls)` helper is added alongside it in the same file.
- No DB migration required. No new secrets required.
