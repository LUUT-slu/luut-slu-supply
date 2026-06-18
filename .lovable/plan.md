## Goal
Add a new, completely independent "Text to Image" section inside the Posters tab of Marketing Studio. The existing poster flow is left untouched.

## Scope
- Create a new component: `src/pages/admin/marketing-studio/TextToImageSection.tsx`
- Mount it inside `PosterTab.tsx` below the existing poster flow (visual separator + heading "Text to Image"). No imports/state shared with the existing flow.
- Create a new, isolated edge function: `supabase/functions/text-to-image/index.ts` that calls Replicate `ideogram-ai/ideogram-v3-turbo` with `style_type: "design"`. No reuse of `marketing-generate`.

## UI (TextToImageSection.tsx)
- Empty `<textarea>` (placeholder: "Describe your poster…"), starts blank every time.
- Aspect ratio selector (segmented buttons): `1:1`, `9:16`, `16:9`, `4:3`, `3:4`. Default `1:1`.
- "Generate" button (disabled while loading or when prompt is empty).
- Loading spinner while waiting.
- Result `<img>` rendered below once complete.
- "Download" button on the result (reuses existing `src/lib/downloadImage.ts`).
- Friendly error message on failure (incl. 402 insufficient-credit).

State is local: `prompt`, `aspectRatio`, `loading`, `imageUrl`, `error`. No product, variant, brand-style, or seed coupling.

## Edge function (`text-to-image`)
- POST `{ prompt: string, aspect_ratio: "1:1"|"9:16"|"16:9"|"4:3"|"3:4" }`
- CORS + Zod validation; JWT verified via `getClaims` (consistent with other functions).
- Calls Replicate REST API directly using `REPLICATE_API_KEY` secret:
  - `POST https://api.replicate.com/v1/models/ideogram-ai/ideogram-v3-turbo/predictions`
  - Body: `{ input: { prompt, aspect_ratio, style_type: "design" } }`
  - Header: `Prefer: wait` for synchronous response; fall back to polling `/v1/predictions/{id}` if status not terminal.
- Returns `{ imageUrl: string }` (first item from `output`).
- Maps 402 → `{ error: "Replicate is out of credit." }` with status 402.

## Client wiring
- TextToImageSection calls the function via `supabase.functions.invoke("text-to-image", { body: { prompt, aspect_ratio } })`.
- No changes to `marketingRouting.ts`, `PromptPreview.tsx`, `LayoutPreview.tsx`, or any existing poster code.

## Files
- New: `src/pages/admin/marketing-studio/TextToImageSection.tsx`
- New: `supabase/functions/text-to-image/index.ts`
- Edited (one import + one JSX block at the bottom): `src/pages/admin/marketing-studio/PosterTab.tsx`

## Secrets
`REPLICATE_API_KEY` already exists in the project (used by `marketing-generate`). No new secret needed.
