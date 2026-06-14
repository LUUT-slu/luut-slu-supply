## Summary
Add a Content Library feature: a new storage bucket + table for saved AI marketing images, an upgraded edge function that persists generated display images, an expanded AI Display Image panel in Marketing Studio (style/aspect ratio/text/reference image/custom prompt/logo overlay), a new `/admin/content-library` page, an AdminHub card, and a "Recently Saved" strip at the bottom of the studio.

## 1. Migration: `supabase/migrations/{ts}_marketing_assets.sql`
- Create public `marketing-assets` storage bucket (via INSERT into `storage.buckets` — note: codebase convention requires `storage_create_bucket` tool; will use that tool instead of SQL for the bucket itself, then add policies via migration).
- Storage policies on `storage.objects`: public SELECT for bucket, admin INSERT/DELETE via `public.has_role`.
- Table `public.marketing_generated_images` with fields: `image_url`, `thumbnail_url`, `generation_type`, `product_title`, `product_handle`, `style`, `aspect_ratio`, `prompt_used`, `reference_image_url`, `logo_applied`, `logo_position`, `created_by` (FK auth.users), plus `id`/`created_at`.
- GRANT SELECT/INSERT/UPDATE/DELETE to authenticated, ALL to service_role.
- ENABLE RLS + single admin-only ALL policy using `public.has_role(auth.uid(), 'admin')`.

## 2. Edge function: `supabase/functions/generate-product-display-image/index.ts`
Overwrite the existing thin version. Pattern copied from `generate-category-image`:
- CORS, admin auth via service-role client + `user_roles` check.
- Input body: `productImageUrl`, `productTitle`, `productCategory`, `style`, `aspectRatio`, `textOverlay?`, `referenceImageUrl?`, `customPrompt?`.
- Build prompt per style (studio/lifestyle/minimal) using exact wording from spec; append text overlay clause; append customPrompt verbatim.
- Call `black-forest-labs/flux-kontext-pro` with `prompt`, `input_image: productImageUrl`, `aspect_ratio`, `output_format: "png"`, `safety_tolerance: 2`, and `reference_image` if provided. Poll for up to 120s.
- Fetch result bytes, upload to `marketing-assets` as `display-{Date.now()}.png` with `upsert: true`, get public URL.
- Insert into `marketing_generated_images` (`generation_type: 'display'`, etc.), return `{ url, id, prompt }`. Error returns `{ error }`.
- Only `REPLICATE_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` used.

## 3. MarketingStudio.tsx — Replace AI Display Image section (lines ~1021–1101)
Keep visibility gated on `selectedProduct`. New controls:
- **A. Style pills** — Studio | Lifestyle | Minimal (default Studio).
- **B. Aspect Ratio pills** — `1:1`, `4:5`, `9:16`, `3:4`, `16:9`, `4:3` (default `1:1`), with pixel dims as `text-[10px] text-muted-foreground` under each.
- **C. Text overlay textarea** (3 rows) — label "Text on image (optional)", placeholder + helper text.
- **D. Reference image upload** — file input (image/*), converted to data URL via `FileReader`, thumbnail preview ≤80px with × remove button.
- **E. Custom prompt notes textarea** (2 rows).
- **F. Logo overlay** — read `settings?.marketingStudio?.brandLogoUrl` from `useSiteSettings()`; if present, show "Add logo to image" `Switch` (default off). When on, show 3×2 grid of position buttons (default Bottom-Right).
- **G. Generate button** — disabled when no product or loading; spinner + "Generating... ~20–40s".
- **H. Result** — preview image; if logo applied, run client-side canvas compositing (load generated image + logo, scale logo to 15% width, draw at chosen position with 8px margin, export PNG data URL/blob). Action buttons: "Save to Library" (only when logo was applied client-side — uploads composited blob to `marketing-assets`, inserts row with `logo_applied: true, logo_position`) OR "Saved ✓" indicator (when no logo). Always show "Download PNG".

All wiring uses `supabase.functions.invoke("generate-product-display-image", { body: {...} })`.

## 4. New page: `src/pages/admin/ContentLibrary.tsx`
- AdminAuth wrapper + Header + BackButton, title "Content Library", subtitle.
- Filter pills: All / Display Images / Posters / Videos → maps to `generation_type` filter.
- Top "Recent" strip: first 6 newest rows as larger cards with "Use in Studio" button → `navigate('/admin/marketing-studio')`.
- Main grid: 1/2/3 columns responsive cards from `marketing_generated_images` ordered desc, limit 50. Each card shows image, hover overlay with `product_title`, aspect badge, style badge, formatted date ("MMM d"), and Download/Delete icon buttons.
- Delete flow: confirm dialog → derive storage path from `image_url` (split on `/marketing-assets/`), call `supabase.storage.from('marketing-assets').remove([path])` + `delete()` row, refetch.
- Empty state with CTA back to studio.

## 5. Wiring
- **`src/App.tsx`**: lazy import `ContentLibrary`, add `<Route path="/admin/content-library" element={<RouteGuard requiredRole="admin"><ContentLibrary /></RouteGuard>} />` near the marketing-studio route.
- **`src/pages/AdminHub.tsx`**: add module card "Content Library" (icon `Images` from lucide), href `/admin/content-library`, placed right after Marketing Studio card.

## 6. MarketingStudio.tsx — "Recently Saved" strip
At the bottom of `<main>` (above closing `</main>`), add a new inline component:
- Fetches last 6 rows from `marketing_generated_images` once on mount.
- If 0 rows, render nothing.
- Otherwise show a Card titled "Recently Saved" with a horizontal scroll row of 80×80 rounded thumbnails. Clicking opens a `<Dialog>` lightbox showing full image + `product_title`, `style`, `aspect_ratio`, formatted date, and a Download button. Card header includes "View all →" link to `/admin/content-library`.

## Scope lock
Created: migration, edge function, ContentLibrary page.
Modified: MarketingStudio.tsx, App.tsx, AdminHub.tsx.
Untouched: poster templates, presets, copy panel, export logic, other edge functions, all non-admin code.