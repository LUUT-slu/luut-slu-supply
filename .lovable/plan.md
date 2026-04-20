

The user wants AI-assisted image prep as an enhancement layer on top of the existing template system. Priority is **Auto Fit + Smart Reframing** because cropping is the main issue.

Let me check what's already in place for image handling and AI.
<lov-tool-use id="toolu_vrtx_01MTQuUNAtRvNsskaJpzyi1j" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/marketing/templates.tsx\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01D2axeCVcG8HGJ7ah42iRYF" name="code--search_files" integration-id="code" data="{\"query\": \"object-(cover|contain)\", \"include_patterns\": \"src/components/marketing/**\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01UwDU9pAG3VP4RoMZyjXKMh" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01VCfdxFKgvhsy5NydzgmAKy" name="code--search_files" integration-id="code" data="{\"query\": \"object-(cover|contain)\", \"include_patterns\": \"src/components/marketing/templates.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XYnVDg2BF4BZv8yFpR7Be6" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01RuBgg71FEX1yVw9mjMjVL9" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/marketing/templates.tsx\", \"lines\": \"1-60\"}">
</lov-tool-use>
I have enough context. Let me present the plan.

<lov-plan>

## AI-Assisted Image Preparation in Marketing Studio

Add an enhancement layer that **prepares product images** before they hit the existing template engine. Templates, layouts, and export pipeline stay exactly as-is — only the image URL flowing in changes.

### Architecture

```text
Product image ──▶ [Image Prep Panel] ──▶ Cached prepared URL ──▶ Existing templates
                       │
                       ├─ Keep Original          (no change, default)
                       ├─ Auto Fit Product       (smart-frame, client-side)
                       ├─ Smart Reframe          (format-aware crop, client-side)
                       ├─ Remove Background      (AI — Gemini image edit)
                       ├─ Expand to Fit          (AI — outpainting via Gemini image)
                       └─ Enhance Image          (sharpen + contrast, client-side)
```

Each prepared image is cached by `(sourceUrl + mode + format)` so re-selecting a mode is instant and re-exports stay consistent.

### Phase 1 — Build now (priority)

**1. New edge function** `supabase/functions/ai-image-prep/index.ts`
- Accepts `{ imageUrl, mode: "remove-bg" | "expand", format }`
- Calls Lovable AI gateway with `google/gemini-3.1-flash-image-preview` (Nano Banana 2 — fast + high quality, perfect for edits)
- Mode prompts:
  - `remove-bg` → "Remove the background completely. Keep the product 100% intact — same colors, same shape, same details, same branding. Output transparent background."
  - `expand` → "Extend the image canvas to {targetAspect} aspect ratio. Fill the new edges with a clean, realistic continuation of the existing background. DO NOT alter, move, or change the product itself. Keep all product details exactly as-is."
- Returns base64 data URL
- Includes safety guard in system prompt: "Never change the product. Only modify framing/background."
- Handles 429/402 errors and surfaces them clearly

**2. New utility** `src/lib/imagePrep.ts` — client-side ops (no AI cost)
- `autoFitProduct(url, format)` — loads image to canvas, detects content bounds via alpha/edge sampling, re-centers with safe margins (10% padding), outputs canvas at target aspect ratio
- `smartReframe(url, format)` — picks ideal crop window based on format aspect ratio while keeping the centered subject fully inside the frame (no edge clipping)
- `enhanceImage(url)` — canvas-based unsharp mask + mild contrast/saturation boost (subtle, never destructive)
- All return data URLs — preview matches export exactly

**3. New hook** `src/hooks/useImagePrep.ts`
- Manages mode state per source image
- Caches results in a `Map<cacheKey, dataUrl>` (per Studio session)
- Loading/error states for AI modes
- Returns `{ preparedUrl, mode, setMode, isProcessing, error }`

**4. New component** `src/components/marketing/ImagePrepPanel.tsx`
- Renders 6 toggle buttons (Original · Auto Fit · Reframe · Remove BG · Expand · Enhance) as a chip row
- Shows small before/after thumbnails when a mode is active
- Per-mode hint text ("AI processing — uses credits" badge on Remove BG and Expand)
- Mobile-friendly tap targets, scrollable horizontally on small screens
- Disabled state during processing with spinner

**5. Studio integration** — `src/pages/admin/MarketingStudio.tsx`
- Add `ImagePrepPanel` directly under product picker / variant selector
- Single-product mode → prep applies to the chosen `productImage`
- Multi-product mode → prep applies per-tile (each product card gets its own mini prep selector OR a "Apply to all tiles" global mode — pick global for simplicity in v1)
- Variant mode → prep applies to selected variant image
- Pass prepared URLs through existing `templateProps.productImage` / `variantImages[].url` / `MultiProductItem.imageUrl` — zero template changes
- Both preview node and hidden export node consume the same prepared URLs → download matches preview

### Phase 2 — Stubs only (not built)
- Per-tile prep in multi-product mode (v1 uses one global mode)
- Server-side caching of AI results in Supabase Storage (v1 uses in-memory session cache)
- Background "blur instead of remove" option
- Side-by-side comparison slider

### Files

**New (4)**
- `supabase/functions/ai-image-prep/index.ts`
- `src/lib/imagePrep.ts`
- `src/hooks/useImagePrep.ts`
- `src/components/marketing/ImagePrepPanel.tsx`

**Edited (1)**
- `src/pages/admin/MarketingStudio.tsx` — mount panel, wire prepared URLs into template props

### Safety guarantees
- AI prompts explicitly forbid altering product color, shape, branding
- "Keep Original" is always default — no AI runs unless user opts in
- AI-edited results shown in preview before export so admin can revert
- Failures fall back to original image with toast

### Out of scope
- Replacing or generating fake products
- Editing the templates themselves
- Auto-applying AI prep without user consent
- Persisted prep history across sessions

### Result
- Pick a tight product photo → tap **Auto Fit** → product re-centers with proper margins instantly (no AI cost)
- Tap **Smart Reframe** when switching to Story format → product fills the 9:16 safely
- Tap **Remove BG** → clean transparent product on the poster (one Gemini call, ~2s)
- Tap **Expand to Fit** → AI extends background for tight crops (one Gemini call, ~3s)
- All existing posters (single, variant, best sellers, low stock, promos) get cleaner product visibility with zero template regressions

