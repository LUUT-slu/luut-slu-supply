# Category Image System

Generate a unique, product-specific AI image for every visible category and subcategory, with full admin control.

## What you'll see

**On the storefront**
- `/c/:main` (CategoryMain) shows each subcategory tile with its own dedicated image (beanies tile → real beanie photo, glasses tile → real glasses, etc.) instead of falling back to the generic Shopify collection image.
- `/shop` and the mega-nav category cards use the same images.
- Empty categories stay hidden — no image is generated or displayed for them.

**In the admin (new "Category Images" page in AdminHub)**
A table of every active category + subcategory with:
- Category name and path (e.g. `Clothing › Beanies`)
- Live thumbnail of the current image
- Source badge: `AI` / `Manual upload` / `Shopify default` / `Missing`
- The exact prompt used
- Sample product titles fed into the prompt (read-only preview)
- Last generated date
- Buttons: **Regenerate**, **Edit prompt & regenerate**, **Upload manually**, **Reset to Shopify image**, **Approve / Reject**
- "Regenerate all missing" bulk action

## How it decides the image (priority)

1. Manual admin upload (if present and approved)
2. AI-generated image stored for that category (if approved)
3. Shopify collection image (existing fallback)
4. First-letter placeholder tile (existing fallback)

## How the AI prompt is built

```
A premium marketplace product photo of {subcategory_or_category},
showing 1-3 real items such as: {sample_product_titles}.
Style: modern, clean, sharp, dark premium background, studio lighting,
mobile-friendly square crop, marketplace-quality, no text, no logos.
```

- Sample titles = up to 5 in-stock product titles in that exact (main, sub) bucket, pulled from Shopify collection products + `seller_products` rows that match.
- Subcategories use the sub name as the primary subject ("beanies", "skull caps", "glasses"). Mains use the main name + a brief mention of its top subs.
- The prompt is editable per category in admin; user edits override the auto-built prompt on next regenerate.

## Generation backend

New Supabase edge function `generate-category-image`:
- Input: `{ categoryKey, prompt? }` where `categoryKey` is `main:<slug>` or `sub:<main>--<sub>`.
- Admin-only (verifies role with service-role client).
- Builds prompt from taxonomy + product samples if none provided.
- Calls Lovable AI Gateway image model `google/gemini-2.5-flash-image` (Nano Banana) — no extra API key needed.
- Uploads the result to a new public Storage bucket `category-images` at `{categoryKey}.png`.
- Upserts a `category_images` row with `image_url`, `prompt_used`, `source = 'ai'`, `last_generated_at`, `status = 'pending'` (or `approved` if admin enables auto-approve).

## Database changes

New table `category_images` (admin-only writes, public read of approved rows):

| column | purpose |
|---|---|
| `category_key` (PK, text) | `main:clothing` or `sub:clothing--beanies` |
| `main_slug`, `sub_slug` | for joins |
| `display_name` | cached title |
| `image_url` | public URL in `category-images` bucket OR external upload |
| `image_source` | `ai` / `manual` / `shopify` |
| `prompt_used` | last prompt sent to the model |
| `prompt_override` | admin-edited prompt, used next regenerate |
| `status` | `pending` / `approved` / `rejected` |
| `last_generated_at`, `updated_at`, `updated_by` | metadata |

Plus a public Storage bucket `category-images`.

## Storefront integration

- Extend `fetchTaxonomy()` in `src/lib/taxonomy.ts` to LEFT JOIN `category_images` (status = `approved`) and attach `image` from there when present, falling back to today's Shopify collection image.
- `CategoryMain.tsx` and any category cards already read `sub.image` / `main.image` — no UI changes needed beyond that.
- A small `useCategoryImage(categoryKey)` hook for places that need to render outside taxonomy (e.g. mega-nav).

## Admin UI

New route `/admin/category-images` (lazy-loaded), linked from AdminHub:
- Lists every taxonomy entry with > 0 products.
- Shows current state and the controls above.
- Regenerate calls the edge function and refreshes the row.
- Manual upload uses Supabase Storage upload to the same bucket and sets `image_source = 'manual'`.
- Edit-prompt opens a textarea pre-filled with the auto-built prompt; saving stores `prompt_override` and triggers regenerate.
- Approve/Reject toggles `status` (only `approved` is shown publicly).

## Exclusions & guardrails

- Only categories with at least one product are listed in admin or considered for generation.
- "Regenerate all" is rate-limited client-side (one request at a time, ~2s delay) and surfaces 429/402 gateway errors with a clear toast.
- Generated images are 1024×1024 square (matches the existing 1:1 crop rule).

## Out of scope (can follow later)

- Auto-regenerate when a new product is added (manual regenerate only for v1).
- Hero/banner variants — v1 ships the square thumbnail; banner/hero columns are reserved in the schema (`image_url_banner`, `image_url_hero`) but not generated yet.

## Files to add / change

- New: `supabase/functions/generate-category-image/index.ts`
- New migration: `category_images` table + `category-images` storage bucket + RLS
- New: `src/pages/admin/CategoryImagesManager.tsx`
- New: `src/hooks/useCategoryImages.ts`
- Edit: `src/lib/taxonomy.ts` (merge approved overrides)
- Edit: `src/pages/AdminHub.tsx` + router (add route + nav entry)
