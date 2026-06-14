# Migrate Marketing Studio AI to Replicate

## Scope
Modify 3 files, create 1 file. No other files touched.

## 1. `supabase/functions/ai-image-prep/index.ts` (rewrite)
- Remove all `LOVABLE_API_KEY` / `ai.gateway.lovable.dev` references.
- Read `REPLICATE_API_TOKEN` from env. Add helper `runReplicate(model, input)` that POSTs to `https://api.replicate.com/v1/models/{model}/predictions` with `Authorization: Token ...`, then polls `GET /v1/predictions/{id}` until `succeeded` / `failed` / `canceled`.
- Mode `remove-bg` → `851-labs/background-remover`, input `{ image: imageUrl }`, return `{ url: output }` (string).
- Mode `expand` → `black-forest-labs/flux-fill-pro`, input `{ image, prompt, aspect_ratio }` where aspect_ratio maps story→9:16, post→1:1, ad→16:9, portrait→4:5. Return `{ url: output[0] }`.
- Keep CORS, request shape, validation. Replace 402 message with "Replicate API error — check your usage at replicate.com".

## 2. `supabase/functions/generate-category-image/index.ts` (edit)
- Remove `LOVABLE_API_KEY` and gateway URL.
- Replace AI call with Replicate `black-forest-labs/flux-1.1-pro`, input `{ prompt: buildPrompt(...), aspect_ratio: "1:1", output_format: "png", output_quality: 90 }`. Poll until `succeeded`.
- Take `output[0]` (URL), fetch it → `arrayBuffer` → `Uint8Array`. Use `contentType = "image/png"`, `ext = "png"`.
- Drop `dataUrlToBytes` usage (helper can stay or be removed; will remove since unused).
- Keep auth check, prompt logic, storage upload, DB upsert identical.

## 3. `supabase/functions/generate-product-display-image/index.ts` (new)
- Admin-only: service-role client, `auth.getUser(token)`, check `user_roles` for `admin` (same pattern as generate-category-image).
- Validate body: `productImageUrl` (required string), `productTitle` (required), `productCategory` (required), `style` ∈ {studio, lifestyle, minimal} default `studio`, `format` ∈ {square, portrait, landscape} default `square`.
- Build prompt per style using the three templates in the spec, interpolating `productTitle`.
- Aspect map: square→1:1, portrait→4:5, landscape→16:9.
- Replicate `black-forest-labs/flux-kontext-pro` with input `{ prompt, input_image: productImageUrl, aspect_ratio, output_format: "png", safety_tolerance: 2 }`. Poll to succeed.
- Return `{ url: output, prompt }` on success, `{ error }` on failure (handle 429/402 with Replicate-specific message).
- CORS headers on every response.
- Note: `verify_jwt` for this function — admin check uses bearer token from Authorization header (same as generate-category-image). Will NOT add a config.toml entry (defaults are fine; current generate-category-image works without one).

## 4. `src/pages/admin/MarketingStudio.tsx` (edit)
- Add a new section/card in the left panel near the existing Image Prep area: heading "AI Display Image".
- Visible only when a product is selected (reuse existing product-selected condition).
- Local state: `displayStyle` ("studio" | "lifestyle" | "minimal", default "studio"), `displayFormat` ("square" | "portrait" | "landscape", default "square"), `displayLoading` boolean, `displayResultUrl` string|null.
- 3 style buttons + 3 format buttons (toggle-style, highlight active).
- "Generate Display Image" button: disabled if no product or loading; on click call `supabase.functions.invoke("generate-product-display-image", { body: { productImageUrl, productTitle, productCategory, style, format } })`. Pull product fields from the existing selected-product object in the studio.
- Loading: spinner + "Generating…" text.
- Result: preview card with the image, a Download button (anchor with `download` attr fetching the URL as blob), and small note "Use as Product Image".
- Errors: `toast.error(error.message || "Generation failed")` via sonner (already used in studio).
- No other layout, preset, copy, or export changes.

## Technical notes
- All Replicate polling: backoff 1.5s, max ~120s; surface clear error on timeout.
- `REPLICATE_API_TOKEN` is already configured in Supabase secrets per user; no secret tooling needed.
- After edits, edge functions auto-deploy.

## Verification
1. `rg "LOVABLE_API_KEY|ai.gateway.lovable.dev" supabase/functions/ai-image-prep supabase/functions/generate-category-image` → no matches.
2. New function file exists and references `REPLICATE_API_TOKEN`.
3. Manually open Marketing Studio with a product selected → new "AI Display Image" section renders with style/format selectors and Generate button.
