

## Fix: Style & Branding (Presets) Not Affecting Single-Product Posters

### Root cause
The Style & Branding panel writes to `activePresetId` + `presetOverrides` → `activePreset` is correctly piped into `MultiProductTemplate.preset`, but **the single-product `MarketingTemplate` ignores `preset` entirely**. Its three layouts (`CleanLayout`, `HypeLayout`, `MinimalLayout` at lines 981/1078/1203 of `templates.tsx`) hardcode all colors, fonts, radii, badge & CTA shapes. They only switch on `style="clean"|"hype"|"minimal"`, and `style` is now permanently `"hype"` (the old style chip row was removed when PresetPicker landed).

Result: changing preset, accent, density, badge shape, CTA shape, etc. does nothing visible on Single Promo posters (the most-used type).

### Fix

**1. Make the single-product template preset-driven** (`src/components/marketing/templates.tsx`)
- In `MarketingTemplate`, when `props.preset` is provided, route to a new unified `PresetLayout` instead of CleanLayout/HypeLayout/MinimalLayout. Keep the old three layouts as fallback when no preset is supplied (back-compat).
- `PresetLayout` reuses the same token-mapping pattern already in `MultiProductTemplate`:
  - `bg = preset.palette.bg` (with `gradient`/`glow`/`dark`/`minimal` background variants)
  - `accent`, `text`, `muted`, `surface` from palette
  - `densityScale(preset.layout.density)` → padding/gap multipliers
  - `preset.layout.radius` → image & card corner radii
  - `preset.typography.scale` × base headline size, `headlineWeight`, `headlineCase`
  - Badge shape/fill via existing `PresetBadge` helper
  - CTA shape/fill via existing `PresetCTA` helper
- Layout structure: hero product image (centered, 1:1 with preset radius), brand mark top-right, headline + tagline + price block, urgency ribbon, CTA button, meetup line bottom — same composition as today's HypeLayout but every visual token reads from preset.
- Variant grid (when `variantImages` present) uses preset surface + radius too.

**2. Remove the dead `style` switching logic from MarketingStudio**
- Delete the unused `STYLES` const and `style` state (`src/pages/admin/MarketingStudio.tsx`).
- Stop passing `style` to `templateProps` / `multiTemplateProps`. The PresetPicker is now the sole styling control.

**3. Wire density override correctly to multi**
- `MultiProductTemplate` already reads `preset.layout.density` — confirm overrides flow through `mergePreset` (they do, verified in `marketingPresets.ts` lines 200-220).

### Files

**Edited (2)**
- `src/components/marketing/templates.tsx` — add `PresetLayout` (single-product, preset-aware); branch `MarketingTemplate` to it when `preset` is present
- `src/pages/admin/MarketingStudio.tsx` — drop unused `style` state and `STYLES` const; remove `style` prop from template props

### Verification (after switch to default mode)
- Switch preset (Clean → Hype → Sale → Luxury) on a Single Promo poster → background, accent, headline color, CTA shape, badge shape all change live
- Tweak Accent color in override panel → headline glow + CTA bg update instantly
- Tweak Density (tight/normal/spaced) → padding & spacing visibly change
- Tweak Badge shape (pill/ribbon/chip) → urgency ribbon shape changes
- Tweak CTA shape (pill/block/outline) → CTA renders correctly
- Multi-product posters still respond to all the same controls (already worked, just confirm no regression)

### Out of scope
- Reworking multi-product (already correctly preset-driven)
- Changing PresetPicker, PresetOverridePanel, or AI extraction
- Persisting presets server-side
- Mobile layout (already addressed in prior turn)

