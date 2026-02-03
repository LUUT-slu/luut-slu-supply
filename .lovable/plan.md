

# Fix Glitchy Image Disappearing on Scroll

## Problem Identified

Images disappear prematurely (before fully leaving the viewport) during scrolling. This creates a visible "glitch" effect.

**Root Cause**: The `transition-transform` CSS property on images creates GPU compositing layers. When scrolling, the browser's compositor may prematurely clip these layers as they approach the viewport edge, causing images to vanish before they should.

---

## Solution

Apply the `will-change: transform` CSS property and add a `backface-visibility: hidden` to stabilize GPU layer compositing. Additionally, ensure the image containers have `overflow: hidden` applied correctly to prevent any clipping artifacts.

This forces the browser to create a stable compositing layer for images that persists throughout the scroll, preventing premature clipping.

---

## Files to Modify

### 1. ProductCard.tsx
**Line 65** - Add `backface-visibility-hidden` and remove transition-transform from the default state:

```tsx
// Before
className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"

// After  
className="h-full w-full object-cover will-change-transform backface-visibility-hidden transform-gpu group-hover:scale-105 group-hover:transition-transform group-hover:duration-300"
```

### 2. UnifiedProductCard.tsx
**Line 110** - Same fix:

```tsx
// Before
className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"

// After
className="h-full w-full object-cover will-change-transform backface-visibility-hidden transform-gpu group-hover:scale-110 group-hover:transition-transform group-hover:duration-500"
```

### 3. WhatPeopleAreBuyingSection.tsx
**Line 55** - Same fix:

```tsx
// Before
className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-103"

// After
className="h-full w-full object-cover will-change-transform backface-visibility-hidden transform-gpu group-hover:scale-103 group-hover:transition-transform group-hover:duration-500"
```

### 4. BestSellersSection.tsx
**Line 61** - Same fix:

```tsx
// Before
className="h-full w-full object-cover transition-transform group-hover:scale-105"

// After
className="h-full w-full object-cover will-change-transform backface-visibility-hidden transform-gpu group-hover:scale-105 group-hover:transition-transform group-hover:duration-300"
```

### 5. src/index.css
Add a global utility class for backface-visibility:

```css
@layer utilities {
  /* Existing utilities... */
  
  /* Prevent GPU clipping artifacts during scroll */
  .backface-visibility-hidden {
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }
}
```

---

## Technical Explanation

| Property | Purpose |
|----------|---------|
| `will-change-transform` | Hints to browser to create a stable GPU layer |
| `backface-visibility: hidden` | Prevents layer flickering/artifacts |
| `transform-gpu` | Forces hardware acceleration via Tailwind |
| Conditional transitions | Transitions only activate on hover, not during scroll |

By moving `transition-transform` to only apply on `group-hover`, the images won't have active transition states during normal scrolling, which eliminates the compositor clipping issue.

---

## Summary

| Component | Change |
|-----------|--------|
| `ProductCard.tsx` | GPU stabilization + conditional transition |
| `UnifiedProductCard.tsx` | GPU stabilization + conditional transition |
| `WhatPeopleAreBuyingSection.tsx` | GPU stabilization + conditional transition |
| `BestSellersSection.tsx` | GPU stabilization + conditional transition |
| `src/index.css` | Add backface-visibility utility class |

