

## Darker Cards + Stronger Borders

### Changes

**1. `src/index.css` — Darken card background and strengthen border**
- Change `--card` from `0 0% 100%` (pure white) to `0 0% 97%` (light grey, like #F7F7F7)
- Change `--border` from `220 13% 87%` to `220 13% 82%` (more visible grey border)

**2. `src/components/ui/card.tsx` — Ensure border is visible**
- Already has `border` class — no change needed, the CSS variable update will handle it.

### Result
Cards will have a subtle off-white tint that separates them from the pure white background, and all borders site-wide will be slightly darker and more visible. No layout or functionality changes.

