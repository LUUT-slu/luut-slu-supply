# Video Studio for Marketing Studio

Add image-to-video generation to `/admin/marketing-studio` without altering any existing poster flow. Powered by Replicate (Kling v2.1 for product clips, Wan 2.2 I2V Fast for poster animation), using the existing `REPLICATE_API_TOKEN` edge function secret.

## 1. New edge function: `generate-product-video`

Path: `supabase/functions/generate-product-video/index.ts`

- CORS preflight + permissive headers (same pattern as `generate-category-image`).
- Admin auth: Service-role Supabase client, `getUser` from `Authorization` header, check `user_roles.role = 'admin'`, return 403 otherwise.
- Input: `{ productImageUrl, productTitle, productCategory, motionStyle: "subtle"|"dynamic"|"cinematic" = "subtle", duration: 5|10 = 5 }`.
- Build prompt from `motionStyle` using the three templates specified (interpolating `productTitle`).
- POST `https://api.replicate.com/v1/models/kwaiyeij/kling-v2.1/predictions` with `Authorization: Token ${REPLICATE_API_TOKEN}`, `Prefer: wait`, body:
  ```
  { input: { image, prompt, duration, aspect_ratio: "9:16", negative_prompt: "blurry, distorted, watermark, text, logo, people, faces, hands, low quality, artifacts" } }
  ```
- Poll `GET /v1/predictions/{id}` every 3s, max 40 polls (120s). On `succeeded` return `{ videoUrl: output[0], prompt }`. On `failed` return `{ error }`. On timeout return `{ error: "Generation timed out" }`.

## 2. New edge function: `generate-product-poster-video`

Path: `supabase/functions/generate-product-poster-video/index.ts`

- Same CORS + admin auth pattern.
- Input: `{ posterImageUrl (URL or data URL), posterType }`.
- Fixed prompt (as specified in the request).
- POST `https://api.replicate.com/v1/models/wan-video/wan-2.2-i2v-480p/predictions` with body:
  ```
  { input: { image: posterImageUrl, prompt, num_frames: 81, aspect_ratio: "9:16", fast_mode: true } }
  ```
- Same 3s / 120s polling logic.
- Response: `{ videoUrl }` on success, `{ error }` otherwise.

Both functions reference only `REPLICATE_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (no `LOVABLE_API_KEY`).

## 3. UI: add "Video" tab to `src/pages/admin/MarketingStudio.tsx`

Only this file is modified. The existing FORMATS tabs + Copy tab stay untouched.

- Add a `<TabsTrigger value="video">Video</TabsTrigger>` next to the existing `Copy` trigger in the `TabsList` at line 1136.
- Add a sibling `<TabsContent value="video">` rendering a new `VideoStudioPanel` component declared inline in the same file (keeps scope locked to one file). When the Video tab is active, none of the existing poster `TabsContent` renders — the tab switch handles the show/hide.

`VideoStudioPanel` contains two stacked cards using the same Card/Button styling already in the file (gold accent matches existing Download JPEG button).

### Section A — Product Video
- Subtitle line.
- Pill group "Motion Style": Subtle / Dynamic / Cinematic (default Subtle).
- Pill group "Duration": 5s / 10s (default 5s).
- "Generate Product Video" button, disabled when `!selectedProduct` or while loading. Loading label: "Generating video... this takes ~30–60s" with spinner.
- On success: render `<video controls autoPlay muted loop>` and a gold "Download MP4" button (fetches the URL and triggers a download).
- Calls `supabase.functions.invoke("generate-product-video", { body: { productImageUrl: selectedProduct.images[0].url, productTitle: selectedProduct.title, productCategory: selectedProduct.category || "", motionStyle, duration } })`.
- Errors surfaced via existing `toast.error`.

### Section B — Animate This Poster
- Subtitle line.
- File `<input type="file" accept="image/png,image/jpeg">` wrapped in a styled "Upload Poster Image" button. On change, convert to base64 data URL via `FileReader.readAsDataURL` and store in local state; show a small thumbnail preview.
- "Animate Poster" button, disabled until an image is uploaded.
- Same loading/success/error UX and Download MP4 button as Section A.
- Calls `supabase.functions.invoke("generate-product-poster-video", { body: { posterImageUrl: dataUrl, posterType } })` using current `posterType` state already in the component.

## Scope lock

Files created:
- `supabase/functions/generate-product-video/index.ts`
- `supabase/functions/generate-product-poster-video/index.ts`

Files modified:
- `src/pages/admin/MarketingStudio.tsx` (add Video tab trigger + TabsContent + inline VideoStudioPanel; no other changes)

No other files, no changes to existing presets/templates/export/copy logic, no new secrets.
