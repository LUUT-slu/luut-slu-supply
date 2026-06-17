## Goal

Rebuild Marketing Studio around a **centralized routing engine** that silently picks the best AI model per task. Users pick a marketing task — not a model.

## Tab structure

Replace today's `Story / Post / Ad / Portrait / Copy` tabs with:

1. **Poster** — promotional graphics with text
2. **Display** — product photography
3. **Video** — keep existing `VideoModule.tsx` unchanged
4. **Library** — browse generated assets

Shared studio header gains a **Brand Style** selector (Default / Tech / Luxury / Streetwear / Sports / Minimal / Apple Inspired / Nike Inspired) that injects style snippets into every prompt.

## Routing engine — `src/lib/marketingRouting.ts`

```text
MODEL_REGISTRY = {
  poster:   ideogram-ai/ideogram-v3-quality   (via replicate)
  display:  google/imagen-4                   (via replicate)
  closeup:  sourceful/riverflow-2.0-pro       (via replicate)
  fallback: google/nano-banana-pro            (via replicate)
}

routeModel(task)                 -> { model, provider, reason }
buildPrompt(task, controls, brandStyle) -> string
buildBrandStyleSnippet(brand)   -> string
```

Routing rules:
- Poster tab — always `ideogram-v3-quality`
- Display tab — `imagen-4` for Product Display / Hero / Lifestyle / Packaging / Human Model; `riverflow-2.0-pro` for Product Closeup
- Anything unmatched — `nano-banana-pro`

Routing is silent — the UI never names a model.

## Poster tab — `PosterTab.tsx`

Controls: Product selector · Reference Images (up to 4) · Campaign Type (Sale / Promotion / New Arrival / Limited Drop / Clearance / Brand Awareness / Event) · Style (Clean / Luxury / Bold / Hype / Modern / Minimal) · Aspect Ratio (1:1 / 4:5 / 9:16 / 16:9 / 3:4) · Text on Image (Headline / Subheadline / Price / CTA) · Additional Prompt Notes · **Generate Poster**.

**Quick Presets**: Flash Sale, New Arrival, Limited Drop, Black Friday, Clearance, Brand Awareness — auto-fill controls.

## Display tab — `DisplayTab.tsx`

Primary control: **Display Goal** (Product Display / Product Closeup / Human Model / Lifestyle Product / Product Hero / Packaging Showcase) — drives routing.

Secondary controls: Style (Studio / Lifestyle / Minimal / Human Model) · Background (Solid / Gradient / Studio Backdrop / Lifestyle Scene / Transparent) · Realism (Standard / Premium / Hyper Realistic / Luxury Brand) · Product Focus (Full / Detail / Texture / Packaging / In Use / Hero Angle) · Aspect Ratio.

**Prompt enhancement engine** (auto-appended by `buildPrompt`):
- Hyper Realistic → "hyper realistic product photography, commercial advertising quality, ultra detailed textures, premium lighting, professional product photography, realistic reflections, 8k detail, studio lighting"
- Luxury Brand → "luxury advertising campaign, premium brand aesthetic, high-end commercial photography, minimal composition, elegant lighting, luxury product presentation"
- Product Closeup → "macro photography, product detail focus, texture preservation, ultra sharp detail, close-up composition"
- Human Model → "commercial lifestyle photography, realistic human interaction, professional model, authentic product usage"
- Lifestyle Product → "real world environment, natural lighting, lifestyle photography, authentic scene"
- Studio → "commercial studio photography, seamless backdrop, premium product presentation"
- Minimal → "minimalist composition, luxury product display, premium negative space"
- Brand Style snippet appended last

**Reference image preservation**: when reference images are present, prompt explicitly instructs "preserve exact product identity, shape, color, branding, logos, materials, and proportions from the reference — enhance presentation only, never redesign the product."

**Quick Presets**: Amazon Listing, Website Hero, Luxury Product, Instagram Product, Product Closeup, Packaging Showcase.

## Prompt Preview Panel

Collapsible "View Final Prompt" panel on Poster and Display tabs — shows the assembled prompt (base + brand style + goal + enhancements + user notes) before the user spends credits.

## Library tab — `LibraryTab.tsx`

Reads `marketing_generated_images`. Filters: Posters / Display / Videos / by Product / by Date / by Campaign / Favorites / Downloads. Tile actions: open, favorite toggle, download (increments `download_count`).

## Database migration

Add to `marketing_generated_images` if missing:
- `campaign_type text`
- `is_favorite boolean default false`
- `download_count int default 0`

## Edge function — `supabase/functions/marketing-generate/index.ts`

Single generation endpoint. Body: `{ task, model, prompt, referenceImages[], aspectRatio, controls }`.

Responsibilities:
1. Admin auth check
2. Normalize reference image URLs (data URL → upload to `marketing-assets`)
3. Build per-model input shape (Ideogram, Imagen-4, Riverflow, Nano-Banana-Pro)
4. Call Replicate via the **Replicate connector gateway** (`https://connector-gateway.lovable.dev/replicate/v1/...`) using the existing connector secrets — no `REPLICATE_API_TOKEN` env required
5. Poll with 429 retry/backoff (reuse pattern from `generate-ai-poster`)
6. Download output → upload to `marketing-assets` bucket
7. Insert row in `marketing_generated_images` (`generation_type` = `poster` or `display`, `campaign_type`, `prompt_used`, etc.)
8. Return long-lived signed URL + DB id

Pre-flight: confirm the Replicate connector is linked. If not, prompt connection during build before deploying the function.

Keep `generate-ai-poster`, `generate-product-display-image`, `generate-product-video`, `generate-product-poster-video` deployed; UI stops calling the first two.

## Files

**New**
- `src/lib/marketingRouting.ts`
- `src/pages/admin/marketing-studio/PosterTab.tsx`
- `src/pages/admin/marketing-studio/DisplayTab.tsx`
- `src/pages/admin/marketing-studio/LibraryTab.tsx`
- `src/pages/admin/marketing-studio/BrandStyleSelector.tsx`
- `src/pages/admin/marketing-studio/PromptPreview.tsx`
- `supabase/functions/marketing-generate/index.ts`

**Modified**
- `src/pages/admin/MarketingStudio.tsx` — swap tab list, keep `VideoModule` + `CreditsPanel`

## Out of scope this pass

- Video model routing (Kling/Veo/Seedance/Runway) — Video tab unchanged
- Deleting the legacy template renderer files (Story/Post/Ad/Portrait components) — just unlinked from tabs
