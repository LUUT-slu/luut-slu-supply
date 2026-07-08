## Two fixes for the Display tab

### 1. Make reference image optional (text-to-image fallback)

Right now `generate()` errors with "Add a reference image or pick a product with an image" when there's nothing to send, because `ai-image-prep` requires `imageUrl`. Fix by branching on whether a reference exists:

- If a reference image is present → keep the current call: `supabase.functions.invoke("ai-image-prep", …)` (image-to-image via Nano Banana Pro). No change.
- If no reference image is present → call the existing `supabase.functions.invoke("text-to-image", { body: { action: "start", prompt, aspect_ratio } })` edge function, then poll `{ action: "status", id }` until it returns `imageUrl`. Set `resultUrl` to that URL. Same toasts / spinner / seed handling.

Aspect ratio mapping for text-to-image: `text-to-image` allows `1:1 | 9:16 | 16:9 | 4:3 | 3:4`. Map `4:5 → 3:4` at call time (visual pick still shows 4:5).

Reference image opt-out UI:
- The auto "AUTO" thumb (product listing image in Shopify mode) becomes dismissible. Add a small `×` on it that sets `autoRefDismissed = true`. Once dismissed, it's not used as fallback.
- In `upload` and `none` source modes, no auto-attach happens (already true for `none`; add it for `upload` — today `upload` also has no auto-attach).
- `hasReference` in `controls` (feeds the prompt compiler) becomes: `refs.length > 0 || (sourceMode === "shopify" && !autoRefDismissed && !!variantImage)`.
- Section subtext gets an "(optional)" hint.

### 2. Always render the Variants section when the product has any variants

Currently the pill row only renders when `product.variants.length > 1`, which is why "SCVCN UV Protective Glasses" (single "Default Title" variant on Shopify) shows nothing to switch. Change to render whenever `product.variants?.length >= 1`:

- Multiple variants → interactive gold pills (as today).
- Single variant → one non-interactive pill labeled with the variant title (e.g. "Default"), plus subtext "Only one variant available. Add more in Shopify to pick a specific one here."

This makes it obvious the picker exists and that the current product simply has no alternative variants — not a UI bug.

### Files touched
- `src/pages/admin/marketing-studio/DisplayTab.tsx` only.
  - Add `autoRefDismissed` state and `×` on AUTO thumb.
  - Refactor `generate()` into a small `generateWithReference()` (existing `ai-image-prep` path) + new `generateFromText()` (text-to-image polling). Pick one based on whether an image is available.
  - Loosen variants block to render at length ≥ 1 with the single-variant fallback UI.

### What stays untouched
- Prompt compiler (`previewDisplayFinal` / `buildDisplayPrompt`).
- `ai-image-prep` edge function and its request payload.
- `text-to-image` edge function (already exists; used as-is).
- `useHybridProducts`, product/variant state derivation, `refs` handling, `MAX_REFS`, `PromptPreview`, `LayoutPreview`, sticky Generate bar, Marketing Studio shell, Poster/Video/Library tabs.

No backend changes.