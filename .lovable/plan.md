

## Invert Website Color Scheme: Dark → Light Theme

### What changes
This is purely a CSS variable swap in `src/index.css`. The entire site uses HSL CSS custom properties — changing the `:root` values will cascade everywhere automatically.

### Technical approach

**Single file edit: `src/index.css`**

Update the `:root` CSS variables to a light theme:

| Variable | Current (dark) | New (light) |
|----------|---------------|-------------|
| `--background` | `0 0% 5%` (near-black) | `0 0% 100%` (white) |
| `--foreground` | `0 0% 95%` (near-white) | `0 0% 7%` (#111) |
| `--card` | `0 0% 8%` | `0 0% 99%` (#FCFCFC) |
| `--card-foreground` | `0 0% 95%` | `0 0% 7%` |
| `--popover` | `0 0% 8%` | `0 0% 100%` |
| `--popover-foreground` | `0 0% 95%` | `0 0% 7%` |
| `--primary` | `43 74% 49%` (gold) | `43 74% 49%` (keep gold) |
| `--primary-foreground` | `0 0% 5%` | `0 0% 100%` (white text on gold) |
| `--secondary` | `0 0% 12%` | `0 0% 96%` (light grey) |
| `--secondary-foreground` | `0 0% 95%` | `0 0% 9%` |
| `--muted` | `0 0% 15%` | `0 0% 96%` |
| `--muted-foreground` | `0 0% 60%` | `0 0% 45%` (#737373) |
| `--accent` | `43 74% 49%` | `43 74% 49%` (keep) |
| `--accent-foreground` | `0 0% 5%` | `0 0% 100%` |
| `--destructive` | `0 72% 51%` | `0 72% 51%` (keep red) |
| `--destructive-foreground` | `0 0% 95%` | `0 0% 100%` |
| `--border` | `0 0% 18%` | `0 0% 90%` (subtle grey) |
| `--input` | `0 0% 18%` | `0 0% 90%` |
| `--ring` | gold | gold (keep) |
| `--shadow-card` | dark shadow | `0 4px 24px hsl(0 0% 0% / 0.06)` (soft) |
| `--shadow-glow` | gold glow | `0 0 40px hsl(43 74% 49% / 0.1)` (softer) |

Also update the `.dark` class block to match (or remove it since the site won't use dark mode).

Update scrollbar styles: track → white, thumb → light grey.

**Scan for hardcoded dark colors** — search for `bg-black`, `text-white`, `bg-[#0` across components. Any hardcoded overrides will be adjusted to use theme tokens or appropriate light-theme equivalents. Key files to check:
- `Header.tsx` — already uses `bg-background`, should work automatically
- `Footer.tsx` — may have hardcoded dark styles
- `SaleBanner.tsx` — check contrast
- `AIChatWidget.tsx` — check bubble colors
- `SignupDiscountPopup.tsx` — uses theme tokens, should work
- Badge components (`UnifiedProductCard.tsx`) — `text-white` on colored badges is fine

### Files to modify
1. `src/index.css` — All CSS variable values (primary change)
2. Any components with hardcoded `bg-black`, `text-white` on non-badge elements, or dark-specific colors

### What stays the same
- Gold/yellow accent color
- All layout, spacing, and functionality
- Font stack (Inter)
- Mobile responsiveness
- Component structure

