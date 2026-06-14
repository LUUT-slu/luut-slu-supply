# Marketing Studio: Preset Redesign + AI Poster Tab

Two independent changes, executed in order.

---

## Change 1 — Redesign builtin presets

**File:** `src/lib/marketingPresets.ts` (only)

Replace the entire `BUILTIN_PRESETS` array with the 7 redesigned presets supplied in the spec. All IDs preserved (`clean`, `hype`, `minimal`, `sale`, `urgency`, `luxury`, `grid-showcase`). Every `surface` is now opaque so the `PresetChip` thumbnail (`bg | surface | accent`) renders three visually distinct swatches per preset. Nothing else in the file changes (helpers, custom-preset functions, validators all kept).

---

## Change 2 — AI Poster generator (Ideogram v3)

A new, separate generation surface alongside the DOM-rendered templates. The existing template system is untouched.

### 2A. New edge function — `supabase/functions/generate-ai-poster/index.ts`

- **Auth:** copies `generate-category-image/index.ts` pattern exactly — service-role client, `auth.getUser(token)` from `Authorization` header, check `user_roles` for `admin`, return 403 otherwise.
- **Input:** `productTitle`, `productPrice`, `productImageUrl`, `ctaText`, `brandName`, `meetupText`, `urgencyText`, `tagline`, `posterStyle` (`hype`|`clean`|`luxury`|`bold`), `aspectRatio` (`9:16`|`1:1`|`4:5`|`16:9`), `customInstructions`.
- **Prompt builder:** one of 4 style templates from the spec, with all literal text wrapped in straight quotes for Ideogram text rendering, plus the fixed Saint Lucia / Caribbean brand suffix, plus `customInstructions` appended if non-empty.
- **Aspect ratio map:** `9:16→portrait_9_16`, `1:1→square_hd`, `4:5→portrait_4_5`, `16:9→landscape_16_9`.
- **Replicate call:** `POST /v1/models/ideogram-ai/ideogram-v3-turbo/predictions`, headers `Authorization: Token ${REPLICATE_API_TOKEN}`. Body uses `prompt`, `aspect_ratio`, `style_type: "DESIGN"`, plus the spec's `negative_prompt`.
- **Polling:** every 3s, max 40 polls (120s). Success → `output[0]`. Failure / timeout → `{ error }`.
- **Storage:** `fetch` → bytes → upload `ai-poster-${Date.now()}.png` to `marketing-assets` (upsert), return `getPublicUrl`. Bucket-not-found returns the explicit "Storage not configured" message.
- **DB insert:** `marketing_generated_images` row (`generation_type: 'poster'`, style, aspect_ratio, prompt_used, created_by). Skip gracefully if missing.
- **Response:** `{ url, prompt }` or `{ error }`. Standard CORS / OPTIONS preflight. Uses only `REPLICATE_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — no `LOVABLE_API_KEY`.

### 2B. Studio UI — `src/pages/admin/MarketingStudio.tsx`

- Add 6 state vars (`aiPosterStyle`, `aiPosterAspectRatio`, `aiPosterCustom`, `aiPosterGenerating`, `aiPosterResult`, `aiPosterPrompt`) plus `showAiPoster`.
- Add `handleGenerateAiPoster` calling `supabase.functions.invoke("generate-ai-poster", …)` with the studio's current product + copy fields.
- Add a tab-styled `<button>` with `Sparkles` icon at the end of the existing `TabsList`. Clicking it sets `showAiPoster(true)`. Wrap the existing `Tabs.onValueChange` so any format tab change sets `showAiPoster(false)`.
- Render the AI Poster panel **conditionally** (`showAiPoster && …`) outside the format `TabsContent` blocks: product summary card, 4 style cards (Hype / Clean / Luxury / Bold), 4 format pills (9:16, 1:1, 4:5, 16:9), extra-instructions textarea, Generate button (disabled when no product or generating), result image with Download PNG + Clear + collapsible "View prompt used".
- Import `Sparkles` from `lucide-react` (added to the existing import line — no duplicate).

### Multi-product poster types — per your answer

The "Use first product only" behavior is implicit in how the panel is wired: `productPayload` is the single hero product already shown in the studio. For multi-product poster types (Best Sellers / New Arrivals / Restocked / Almost Gone / Promotions), the panel automatically uses the first product from the active list as `productPayload` — which is exactly what the studio already exposes via the existing `productPayload` derivation. No additional plumbing is needed: the AI Poster tab works for every poster type, always taking the first product as the hero. The poster type's headline (e.g. "JUST DROPPED") is not injected into the AI prompt — the AI style templates own the headline language.

---

## Scope lock

**Create:** `supabase/functions/generate-ai-poster/index.ts`
**Modify:** `src/lib/marketingPresets.ts`, `src/pages/admin/MarketingStudio.tsx`
**Do not touch:** `templates.tsx`, `PresetPicker.tsx`, any other edge function, any other page/hook/component.

## Verification after build

1. PresetPicker thumbnails show 7 visibly distinct presets.
2. `generate-ai-poster` deploys and uses `REPLICATE_API_TOKEN` only.
3. "AI Poster" tab with Sparkles icon appears in the studio.
4. Switching format tabs hides the AI panel; clicking AI Poster shows it.
5. Generate disabled until a product is selected; works for single + multi-product poster types using the first product as hero.
6. Result shows image + Download PNG + Clear + prompt details.
