
# Static Hero Section -- Performance Fix

## Problem
LCP is 11.3s on mobile. The hero section has:
1. A `vignette-open` CSS keyframe animation (2.5s) that overlays the hero image with an animated radial gradient, delaying when the browser considers the image "painted"
2. A gradient overlay div (`from-black/30 via-black/40 to-black/90`) on top of the image
3. Staggered `animate-fade-in` + `opacity-0` on all buttons and the vendor link, with `animationDelay` up to 0.8s -- these start invisible and fade in
4. The `vignette-open` keyframe definition in `index.css` (lines 130-145)
5. Related `hero-zoom` and `light-reveal` keyframes/animations in `tailwind.config.ts` (unused but adding CSS weight)

## Changes

### File 1: `src/pages/Index.tsx`

**Remove the vignette overlay div entirely** (lines 61-67). This animated div sits on top of the hero image and delays LCP because the browser sees the gradient layer as the largest paint, not the image underneath.

**Remove the gradient overlay div** (line 80). The `bg-gradient-to-b from-black/30 via-black/40 to-black/90` adds a paint layer over the image. Replace with a simpler, static bottom-only gradient using a CSS `background` on the content container instead, ensuring text readability without covering the full image.

**Remove all `animate-fade-in opacity-0` classes and `style` attributes** from the three buttons (lines 86, 92, 95) and the vendor link wrapper (line 99). Buttons will be visible immediately.

Result: The hero becomes a static image with visible buttons on first paint. No animation, no opacity transitions, no delayed rendering.

### File 2: `src/index.css`

**Remove the `@keyframes vignette-open` block** (lines ~130-145). No longer referenced.

### File 3: `tailwind.config.ts`

**Remove unused `hero-zoom` and `light-reveal` keyframes and their animation entries.** These are dead code that adds to the CSS output size.

## What stays the same
- Layout structure (min-h-[90vh], flex-col justify-end)
- Image source (`/storefront-hero.webp`) with `fetchPriority="high"` and `decoding="sync"`
- Button text, links, and routing
- All other sections below the hero

## Expected Impact
- The hero image becomes the LCP element and paints as soon as the WebP loads -- no animation layer blocking it
- Removing opacity-0 + fade-in means buttons render on first frame
- Fewer CSS keyframes = smaller stylesheet
