
The user is looking at the current preview (Hype preset, PresetLayout) and saying it doesn't match the original poster style they wanted to keep. The previous "nike-shox-nz-post-hype.png" they uploaded was the ORIGINAL HypeLayout (the legacy one we just deleted). The current PresetLayout renders differently — different typography, spacing, badge placement, CTA shape, etc.

So they want the OLD legacy `HypeLayout` look back as the default, not the new `PresetLayout`. The previous turn deleted those legacy layouts entirely. We need to restore the original Hype look.

Let me check what the legacy HypeLayout looked like vs current PresetLayout.

### Plan

Restore the original Hype poster look as the default single-product style, while keeping all presets functional through the unified pipeline.

**Approach: Make `PresetLayout` (with Hype tokens) visually match the original `HypeLayout`.**

Rather than reintroducing the deleted legacy code branch, update `PresetLayout` so that when rendered with the Hype preset it produces the exact original look the user approved earlier (dark gradient bg, "LUUT SLU" mark top-right, framed product image, green "LIMITED DROP" pill above title, large white "NIKE SHOX NZ" headline with green accent on second word, bold green "EC$300" price, green pill "DM TO BUY" CTA, meetup line at bottom). Other presets (Clean, Minimal) keep their token-driven variations.

### Files
- `src/components/marketing/PresetLayout.tsx` — refine the layout rendering to match the original Hype poster: image framing, badge styling above title, headline split with accent on second word, price weight, CTA pill sizing, meetup line, "LUUT SLU" wordmark position.
- `src/lib/marketingPresets.ts` — verify Hype preset tokens (accent #39ff7a, glow, density, badge "pill", CTA "pill") produce the desired result; tweak spacing tokens if needed.

### Verification
- Default load shows the exact same poster as the previously approved screenshot (dark bg, green accent, "LIMITED DROP" pill, big white headline, green price, green "DM TO BUY" pill).
- Switching to Clean / Minimal presets still changes palette + density.
- Style & Branding overrides (accent, density, badge shape, CTA shape) still work.
