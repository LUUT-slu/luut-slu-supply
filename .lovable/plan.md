
The user wants the new `PresetLayout` (the preset-driven single-product poster) to be used for ALL presets, including the default Hype preset. Remove the legacy fallback that was added in the previous turn so that every preset — including default — renders through `PresetLayout`.

### Root state
Currently in `src/pages/admin/MarketingStudio.tsx`:
```ts
const isDefaultStyle = activePresetId === "hype" && Object.keys(presetOverrides).length === 0;
preset: isDefaultStyle ? undefined : activePreset,
```
This makes the default Hype preset fall back to the old hardcoded `HypeLayout`. The user wants to drop that fallback so the new preset-driven layout is always used.

### Fix

**1. `src/pages/admin/MarketingStudio.tsx`**
- Remove the `isDefaultStyle` check.
- Always pass `preset: activePreset` to `templateProps`.
- Result: every preset (including Hype default) routes through `PresetLayout`.

**2. `src/components/marketing/templates.tsx`** (cleanup)
- Remove the now-unused legacy `CleanLayout`, `HypeLayout`, `MinimalLayout` branches inside `MarketingTemplate` (the `!usePreset` fallback path).
- Keep the `style` prop in the type for back-compat but stop branching on it.
- `MarketingTemplate` always renders `PresetLayout`.

### Files
- `src/pages/admin/MarketingStudio.tsx` — drop `isDefaultStyle`, always pass `activePreset`
- `src/components/marketing/templates.tsx` — remove legacy layout fallback branches; always use `PresetLayout`

### Verification
- Open Single Promo with default Hype preset → renders through new `PresetLayout` (preset-driven)
- Switch to Clean / Sale / Luxury → all use the same unified layout, only tokens change
- Style & Branding controls (accent, density, badge, CTA shape) work uniformly across every preset
