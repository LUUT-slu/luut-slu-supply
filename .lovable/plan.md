
## Goal

Redesign `/admin/marketing-studio` for desktop (≥1024px) only with a 3-column "studio" shell in black/white/silver. Mobile (<1024px) stays pixel-identical. No generation logic, edge function call, Supabase query, state, or handler changes.

## Approach

Rather than rewrite the 2,400-line `MarketingStudio.tsx`, wrap the existing render tree in a new desktop chrome that is only visible at `lg:` and hide the current chrome at `lg:`. The same React state, same forms, same buttons, same Generate handler — just re-skinned and re-laid-out via Tailwind `lg:` utilities and a scoped CSS block. Mobile classes stay; we only add `lg:` overrides.

### New desktop shell (lg+ only)

```text
┌──────────────────────────────────────────────────────────────────┐ 54px topbar
│ [plug] LUUT SLU │ MARKETING STUDIO            [Poster|Display|Video|Library] │
├────────────┬──────────────────────────────────────┬──────────────┤
│  300px     │     center canvas (flex-1)           │   180px      │
│  sidebar   │  ┌ toolbar: Regenerate Edit · Share Download ┐      │
│  scroll    │  │                                     │      │
│            │  │         poster preview (scaled)     │  right strip │
│            │  │                                     │      │
│            │  └ dims label (muted)                  │      │
├────────────┴──────────────────────────────────────┴──────────────┤ 36px status
│ • last generated · model · Replicate credit                       │
└──────────────────────────────────────────────────────────────────┘
```

- New file `src/pages/admin/marketing-studio/DesktopShell.tsx` renders topbar, sidebar slot, canvas slot, right-strip slot, status bar. All children passed in as props from `MarketingStudio.tsx` so existing handlers/state are reused 1:1.
- `MarketingStudio.tsx` keeps current JSX behind a `lg:hidden` wrapper. The new `<DesktopShell>` renders behind a `hidden lg:flex` wrapper. Zero shared visual styles — clean fork at the breakpoint.

### Color tokens (desktop-only)

Add a scoped class `.studio-desktop` on the desktop shell root and define tokens inside `src/index.css` under `@media (min-width: 1024px)`:

```css
@media (min-width: 1024px) {
  .studio-desktop {
    --s-bg: #080808;
    --s-surface: #0c0c0c;
    --s-card: #111;
    --s-border: #1c1c1c;
    --s-text: #e8e8e8;
    --s-text-2: #aaa;
    --s-muted: #555;
    --s-muted-2: #3a3a3a;
  }
}
```

All desktop components consume these via arbitrary-value Tailwind classes (`bg-[var(--s-surface)]`, `border-[var(--s-border)]`, `text-[var(--s-text)]`) so mobile tokens are unaffected.

### Green removal (desktop only)

Audit `MarketingStudio.tsx` for `#c8ff00`, `fuchsia-`, `lime-`, neon green utility classes, and `text-primary`/`bg-primary` usage that resolves to the green brand color. In the desktop tree only, swap them for the silver tokens above. Mobile tree keeps the existing classes.

### Sections to re-skin in desktop shell

- **Topbar (54px)**: plug logo + `LUUT SLU` wordmark (tracking-[0.18em] uppercase) + thin `1px` separator + `MARKETING STUDIO` muted label · right side pill group of tabs (Poster, Display, Video, Library) bound to existing `tab`/`setTab` state and the existing `studioMode` toggle for Video.
- **Left sidebar (300px, scroll)**: product card with Change button (existing product selector handler), 2×2 style grid (Hype/Clean/Luxury/Bold — wired to existing `posterStyle` state), format pills 9:16/1:1/4:5/16:9 (wired to existing `format`), Urgency / Tagline / Pickup / Extra instructions inputs (existing state), Generate button at bottom calling existing `generateAiPoster` handler.
- **Center canvas**: Regenerate + Edit buttons left (existing handlers), Share + Download right with Download `border-[#888]`. Preview image reuses `PreviewBox`/existing poster `<img>`; centered with `object-contain` and a max-h that respects available viewport. Dimensions label below in `text-[var(--s-muted)]`.
- **Right action strip (180px)**: visible only when a generated image exists. Ready label, style/format/model meta, divider, primary Download (calls existing `handlePosterAction`), Share via WhatsApp / Copy link / Save to library, divider, Regenerate / Adjust prompt. All bound to existing handlers; WhatsApp share builds the same URL pattern used elsewhere in the file.
- **Status bar (36px)**: dot, last generated timestamp (from existing generation result), model name, Replicate credit pill on the right (static label, no new API call).

### Files touched

- `src/pages/admin/MarketingStudio.tsx` — wrap existing root in `lg:hidden`, mount `<DesktopShell …/>` in `hidden lg:flex`, pass handlers/state as props.
- `src/pages/admin/marketing-studio/DesktopShell.tsx` *(new)* — pure presentational shell, no business logic.
- `src/pages/admin/marketing-studio/desktop/` *(new)* — small subcomponents: `TopBar.tsx`, `Sidebar.tsx`, `Canvas.tsx`, `ActionStrip.tsx`, `StatusBar.tsx`.
- `src/index.css` — add the `@media (min-width: 1024px) .studio-desktop { … }` token block. No global rule changes.

### Explicit non-goals

- No mobile changes (no class removal/edit on the existing tree).
- No changes to `generate-ai-poster`, `generate-product-display-image`, video edge functions, or any Supabase query.
- No new dependencies.
- No changes to the Video studio panel internals — it just renders inside the new canvas slot when the Video tab is active.

### Verification

After implementation: load `/admin/marketing-studio` at 1280×800 — confirm new shell, no green anywhere, Generate still works end-to-end. Resize to <1024px — confirm the original mobile layout reappears unchanged.
