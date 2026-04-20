

Looking at the current Marketing Studio architecture: there's already a `style` toggle (Clean/Hype/Minimal) baked into `templates.tsx`, plus `pickTheme()` that auto-picks a glow palette from the headline. The user wants to formalize this into a **proper preset system** driven by reference images, with token extraction (not image cloning).

Key insight: this is NOT about AI generating posters from references. It's about extracting **design tokens** (palette, layout density, badge style, CTA shape) from a reference image once, saving them as a **named preset**, then having the existing template engine render any poster type with those tokens.

## Reference-Based Design Preset System

Turn the existing 3-style toggle into a full preset library. Each preset is a JSON token bundle (palette + layout + typography + decoration). References become presets via one-time AI extraction; templates render predictably from tokens.

### Architecture

```text
[Reference image] ──▶ [AI Extract Tokens] ──▶ [PosterPreset JSON]
                                                      │
                                                      ▼
[Built-in presets] ─────────────────────────▶ [Preset Library] ─▶ [Apply to template]
   Clean · Hype · Minimal                              │
   Sale · Urgency · Luxury · Grid Showcase             ▼
                                              [Override panel]
                                              colors · CTA · density
```

### What gets built

**1. Preset schema** — `src/lib/marketingPresets.ts`
- `PosterPreset` type: `{ id, name, palette: {bg, surface, accent, glow, text, muted}, layout: {density: "tight"|"normal"|"spaced", radius, gridGap}, typography: {headlineWeight, headlineCase, scale}, badge: {shape: "pill"|"ribbon"|"chip", style: "glow"|"solid"|"outline"}, cta: {shape, fill: "glow"|"solid"|"outline"}, background: {type: "dark"|"gradient"|"glow"|"minimal", noise: boolean} }`
- 7 built-in presets: Clean, Hype, Minimal, Sale (red/yellow), Urgency (ember), Luxury (gold/black), Grid Showcase (neutral)
- `getPreset(id)` + `mergePreset(preset, overrides)`

**2. Preset extraction edge function** — `supabase/functions/marketing-extract-preset/index.ts`
- Input: `{ imageDataUrl, presetName }`
- Calls `google/gemini-2.5-flash` with vision + structured output (tool calling) to return a `PosterPreset` JSON matching the schema
- System prompt: "Extract design tokens — palette hex codes, layout density, badge style, CTA shape, background type. Do NOT describe the image content. Do NOT include any product or text from the reference. Output structured tokens only."
- Returns the new preset JSON for client-side save (no DB needed; presets stored in `localStorage` keyed `marketing.presets.custom`)

**3. Preset Picker component** — `src/components/marketing/PresetPicker.tsx`
- Horizontal chip row above format tabs
- Shows built-in presets + saved custom presets with mini swatch (palette dots + accent stripe)
- "+ Add from reference" button → opens upload dialog
- Upload dialog: drop zone → progress → "Name your preset" → save to localStorage
- Delete custom presets via long-press / X icon

**4. Template token wiring** — extend `src/components/marketing/templates.tsx`
- Replace hardcoded `pickTheme()` colors and the `style` switch with token reads from active `PosterPreset`
- `PosterTheme` becomes derived from `preset.palette` (keep existing field names for zero breakage)
- Apply `preset.layout.density` → padding/gap multipliers
- Apply `preset.badge` → swap badge component (pill vs ribbon vs chip)
- Apply `preset.cta` → swap CTA shape/fill
- Apply `preset.background` → background renderer (dark / gradient / glow / minimal)
- Existing `style: "clean"|"hype"|"minimal"` becomes a fallback when no preset chosen → maps to built-in presets

**5. Override panel** — extend existing branding card in `MarketingStudio.tsx`
- New "Customize preset" collapsible:
  - Color pickers: accent, glow (live updates, doesn't mutate saved preset)
  - Density: Tight / Normal / Spaced toggle
  - Badge shape: Pill / Ribbon / Chip
  - CTA shape: Pill / Block / Outline
- Reset to preset defaults button

**6. Studio integration** — `src/pages/admin/MarketingStudio.tsx`
- New state: `activePresetId: string`, `presetOverrides: Partial<PosterPreset>`
- Pass merged preset as a prop into both single-product and multi-product templates
- Hide the old style chip row when preset system is active (or repurpose it as a quick-pick for built-ins)
- Both preview node and export node consume the same merged preset → download matches preview

### Files

**New (4)**
- `src/lib/marketingPresets.ts` — schema + 7 built-ins + merge helpers
- `src/components/marketing/PresetPicker.tsx` — chip row + upload dialog
- `src/components/marketing/PresetOverridePanel.tsx` — color/density/shape controls
- `supabase/functions/marketing-extract-preset/index.ts` — AI token extraction

**Edited (2)**
- `src/components/marketing/templates.tsx` — token-driven theme + badge + CTA + background renderers
- `src/pages/admin/MarketingStudio.tsx` — mount picker + override panel, pass preset down

### Safety / consistency
- Tokens are bounded enums (density: 3 values, badge: 3 shapes, cta: 3 shapes) → predictable output, never random
- AI extraction returns ONLY tokens, never image content → no copying
- Built-in presets always available even if extraction fails
- Custom presets stored locally per admin session (Phase 2 can sync to DB)

### Result
- Pick "Sale" preset → red/yellow palette, ribbon badges, urgent CTA across all poster types
- Upload screenshot of a poster I like → AI extracts palette + layout density + badge style → save as "My Drop Style" → reuse on Best Sellers, New Arrivals, Promotions
- Tweak accent color via override → instant preview update, doesn't touch saved preset
- All existing functionality (variants, image prep, multi-product, format tabs) preserved

### Out of scope
- Server-side preset storage (localStorage only in v1)
- Preset sharing between admins
- AI generating posters from references (token extraction only)
- Animated/video presets

