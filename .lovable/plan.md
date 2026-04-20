

The user is confirming the existing approach — Marketing Studio already uses template-based image generation with real product images via `html-to-image`. No AI image generation is in place. So this is mostly a confirmation + small refinements.

Let me check what's currently rendered vs what they want:

Current state (`templates.tsx` + `MarketingStudio.tsx`):
- ✅ Uses real product image as main visual
- ✅ Overlays product name, price, description, brand, CTA
- ✅ 3 styles: Clean, Hype, Minimal
- ✅ 3 formats: Story (1080x1920), Post (1080x1080), Ad (1200x628)
- ✅ html-to-image PNG export
- ✅ No AI image generation

What's missing from spec:
- "Short tagline" field — currently uses `description`. Add explicit `tagline` input separate from description.
- CTA examples like "DM to order", "Available now" — already configurable but defaults could match.
- Logo overlay — `brandLogoUrl` exists in settings but templates don't render it. Add small logo mark to each template.
- Ad format described as "portrait" in spec, but currently 1200x628 landscape. Clarify: keep 1200x628 (standard FB/IG ad) OR add a portrait 1080x1350 ad format.

## Plan: Confirm & Polish Marketing Studio Templates

The Marketing Studio already does exactly what's asked — template-based, real product images, no AI image generation. Only small additions needed.

### Changes

**1. Add Tagline field** (`MarketingStudio.tsx` + `templates.tsx`)
- New input "Short tagline" (separate from description)
- Renders as a small accent line above/below product name in all 3 styles
- Defaults to empty (optional)

**2. Render brand logo when set** (`templates.tsx`)
- If `brandLogoUrl` from site settings is set, show it as a small mark (top-right on Story/Post, top-left on Ad) at ~80px height with `crossOrigin="anonymous"`
- Falls back to text-only brand name when no logo

**3. Add portrait Ad format** (`templates.tsx` + `MarketingStudio.tsx`)
- Keep existing 1200×628 landscape ad
- Add new format option "Portrait Ad" at 1080×1350 (IG feed-friendly ad ratio)
- Format tabs become: Story · Post · Ad · Portrait

**4. Update default CTA suggestions** (`MarketingDefaultsCard.tsx`)
- Helper text under CTA field listing examples: "DM to order", "Available now", "Cop in DM", "Link in bio"
- No behavior change — just guidance

### Files Edited
- `src/components/marketing/templates.tsx` — add tagline + logo + portrait format
- `src/pages/admin/MarketingStudio.tsx` — tagline input, portrait tab option
- `src/components/marketing/MarketingDefaultsCard.tsx` — CTA helper text

### Out of scope
- AI image generation (explicitly excluded)
- Background removal
- Custom uploaded backgrounds
- Logo upload UI (logo URL field already exists in settings)

