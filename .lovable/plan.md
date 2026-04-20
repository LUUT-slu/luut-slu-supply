

## Fix Marketing Studio Preview Cropping

### Root Cause
- `PREVIEW_SCALE` is a fixed number per format — doesn't adapt to available container width
- Preview wrapper has `overflow-hidden`, hiding anything that exceeds calculated bounds
- On mobile (390px viewport, ~340px card content), even a "small" scale can clip; on desktop the scale is too small and wastes space
- Nested transform wrappers add complexity but don't solve responsiveness

### Fix
Replace fixed-scale logic with a **ResizeObserver-driven dynamic scale** so the preview always fits its container exactly, on every breakpoint, while preserving the true output aspect ratio.

### Changes (single file: `src/pages/admin/MarketingStudio.tsx`)

1. **Remove** the fixed `PREVIEW_SCALE` constant
2. **Add** a `usePreviewScale` hook (or inline logic) that:
   - Measures the preview container's width via `ResizeObserver`
   - Calculates `scale = containerWidth / templateWidth`
   - Caps scale at `1` (never upscale beyond native size)
   - Recomputes on resize / format change
3. **Restructure** the preview wrapper:
   - Outer container: `w-full`, no fixed height, no `overflow-hidden`
   - Inner sized box: `width = templateWidth * scale`, `height = templateHeight * scale` — this defines the aspect ratio container
   - Template: rendered at native size with `transform: scale(N); transform-origin: top left`
   - `mx-auto` on the inner box for centering
4. **Cap max preview width** with `max-w-[420px]` on desktop so the controls panel stays readable, but still scales down freely on mobile
5. **Remove** the redundant nested `transform: scale(1/1)` wrapper (no-op)

### Result
- Story (9:16), Post (1:1), Ad (1.91:1), Portrait (4:5) all render fully within their card on **mobile (390px)**, **tablet (768px)**, and **desktop (1024px+)**
- Aspect ratio always preserved
- Image always centered
- Nothing clipped at any breakpoint
- Downloaded PNG unchanged (export node renders at native 1080×1920 etc.)

### Out of scope
- Template internals (templates.tsx) — no changes needed
- Export resolution / quality — unaffected
- Copy tab — unaffected

