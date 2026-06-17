## Problem

Every poster comes back neon-green-on-black regardless of the selected style because:

1. `generateAiPoster` in `src/pages/admin/MarketingStudio.tsx` never sends `aiPosterStyle` to the edge function.
2. `supabase/functions/generate-ai-poster/index.ts` hardcodes LUUT's neon-green-on-black palette in both `buildScenePrompt` (rim lighting, dark studio) and `buildOverlayPrompt` (`#39FF14` accent, pitch-black background, neon green pill/ribbon/brand).

So the style pills in the UI are purely cosmetic.

## Fix

### 1. Add a "Default" style and re-order the pills

In both `src/pages/admin/marketing-studio/DesktopChrome.tsx` and `MobileShell.tsx`, extend the `PosterStyle` / `AiStyle` union and the `STYLES` array to:

- `default` — "Default" — LUUT brand (black + neon green)
- `hype` — "Hype" — neon green, dark, streetwear energy
- `clean` — "Clean" — neutral white/grey, minimal
- `luxury` — "Luxury" — gold / warm tones, premium
- `bold` — "Bold" — high contrast, no fixed colour cast

In `MarketingStudio.tsx`, widen the `aiPosterStyle` state union to include `"default"` and change the initial value to `"default"`.

### 2. Send the style to the edge function

In `generateAiPoster` (around line 402), include `posterStyle: aiPosterStyle` in the invoke body.

### 3. Make the edge function honour the style

In `supabase/functions/generate-ai-poster/index.ts`:

- Add `posterStyle?: "default" | "hype" | "clean" | "luxury" | "bold"` to `PosterInput` (default `"default"`).
- Replace the hardcoded neon-green language in `buildScenePrompt` and `buildOverlayPrompt` with a small `STYLE_PRESETS` map keyed by style, each entry providing:
  - `sceneBackground` (e.g. `"deep black studio background with subtle neon green rim lighting"` for default/hype, `"bright neutral off-white seamless studio backdrop with soft diffused lighting"` for clean, `"warm champagne-gold gradient backdrop with soft golden rim light and subtle marble surface"` for luxury, `"high-contrast editorial backdrop, dramatic single-source light, deep shadows, no fixed colour cast"` for bold)
  - `paletteText` (e.g. `"pitch-black background, neon green accent color (#39FF14)"`, `"clean white background with charcoal grey (#222) text and a single thin black accent line"`, `"deep ivory / warm cream background with metallic gold (#C9A24B) accents and dark espresso text"`, `"stark editorial palette — pure black, pure white, one bold red (#E5251D) accent only"`)
  - `priceChipText` and `ctaText` styling lines that reuse the palette (e.g. price pill / CTA ribbon colours).
  - `typography` flavour ("heavy condensed Bebas-Neue style" for hype/default/bold, "refined modern sans-serif (Inter / Söhne)" for clean, "elegant serif headlines (Playfair / Didone)" for luxury).
- `buildScenePrompt(title, style)` and `buildOverlayPrompt(input, style)` interpolate from the preset instead of hardcoding neon green.
- Keep `default` and `hype` similar but not identical (default = LUUT canonical neon-green-on-black, hype = same palette but with extra streetwear/grit/graffiti energy in scene + typography).
- Persist `style: \`${posterStyle}|flux-kontext+ideogram\`` in `marketing_generated_images` so the gallery badge reflects the chosen style.

### 4. Deploy

Redeploy `generate-ai-poster` after the edits.

## Out of scope

- No changes to aspect-ratio handling, Flux/Ideogram model choice, or the custom-image upload flow.
- No new UI controls beyond adding the fifth pill.

## Files touched

- `src/pages/admin/MarketingStudio.tsx`
- `src/pages/admin/marketing-studio/DesktopChrome.tsx`
- `src/pages/admin/marketing-studio/MobileShell.tsx`
- `supabase/functions/generate-ai-poster/index.ts`
