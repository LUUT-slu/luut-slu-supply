## Goal

Upgrade the **Build Prompt** button in `TextToImageSection.tsx` so it sends the structured form fields to Lovable AI Gateway (`google/gemini-2.5-flash`) using the creative-director system prompt provided. The returned prompt is shown in the existing editable textarea and used as-is by Generate.

## Changes

### 1. New edge function: `supabase/functions/build-poster-prompt/index.ts`
- `verify_jwt = false` style call (matches existing pattern).
- Accepts JSON: `{ campaignType, headline, subheadline, keyDetail, dateRange, locations, style, realism, brandStyle, brandSnippet }`.
- POSTs to `https://ai.gateway.lovable.dev/v1/chat/completions` with `Lovable-API-Key: ${LOVABLE_API_KEY}`.
- Model: `google/gemini-2.5-flash`.
- System message: the full creative-director prompt from the user message (verbatim).
- User message: structured list of the campaign fields.
- Returns `{ prompt: string }`.
- Handles 429 / 402 with clear error.

### 2. `src/pages/admin/marketing-studio/TextToImageSection.tsx` (only file edited in frontend)
- Add a new **Realism Level** pill selector: `Standard | Premium | Hyper Realistic` (state `realism`).
- Rewrite `handleBuildPrompt` to be `async`:
  - Validate at least one of headline/subheadline/keyDetail is filled.
  - Set a `building` loading state; disable button + show spinner with label "Writing prompt…".
  - Call `supabase.functions.invoke("build-poster-prompt", { body: { ...fields, brandStyle, brandSnippet: getBrandStyleDef(brandStyle)?.snippet ?? "" } })`.
  - On success: `setFinalPrompt(data.prompt)` and toast "Prompt ready — edit, then generate".
  - On error: toast the message; do not overwrite existing finalPrompt.
- Remove the old local `buildPrompt()` string-concatenation helper (no longer used).
- Keep everything else (Generate button, library save, result display, download) unchanged.

## Out of scope
- No changes to `PosterTab.tsx`, the existing `generate-poster-t2i` function, or any other poster flow.
- Image style/look is governed by the new AI-written prompt — no code-level layout changes.
