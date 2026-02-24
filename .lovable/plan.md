

# Fix: Buttons Not Registering Clicks/Taps Site-Wide

## Root Cause

Two bugs are preventing buttons from working on first tap/click:

**Bug 1 -- CSS `background-color: inherit !important` override (index.css)**

The `@media (hover: none)` block applies `background-color: inherit !important` to every button, link, and clickable element on hover. This forces the browser to recalculate the background from the parent element on every interaction, which interferes with the normal click/tap event cycle. The browser processes the hover style change first, swallowing the click event on the first attempt.

This rule is unnecessary because the Button component already has `touch-manipulation` in its class list, which is the correct CSS property that tells the browser "don't wait for double-tap zoom -- fire click immediately."

**Bug 2 -- BackButton onClick guard blocks all clicks on touch-capable devices**

The BackButton component checks `!('ontouchstart' in window)` before allowing `onClick` to fire. On any device that supports touch (including most modern laptops), this condition is `false`, so clicks never register. The button only works through its custom `onTouchEnd` handler, which can reject taps if the finger moved more than 10 pixels.

## Fix

### File 1: `src/index.css`

Remove the harmful hover overrides from the `@media (hover: none)` block. Keep only the `-webkit-tap-highlight-color: transparent` rule (cosmetic, harmless) and the `active` state rules (for tap feedback).

Before:
```css
@media (hover: none) {
  button, a, [role="button"], .cursor-pointer {
    -webkit-tap-highlight-color: transparent;
  }
  button:hover, a:hover, [role="button"]:hover, .cursor-pointer:hover {
    transition: none !important;
    background-color: inherit !important;
  }
  button:active, a:active, [role="button"]:active, .cursor-pointer:active {
    transition: none !important;
  }
}
```

After:
```css
@media (hover: none) {
  button, a, [role="button"], .cursor-pointer {
    -webkit-tap-highlight-color: transparent;
  }
}
```

### File 2: `src/components/BackButton.tsx`

Simplify to use a normal `onClick` handler. Remove the custom touch tracking and the `'ontouchstart' in window` guard. The `touch-manipulation` CSS class already handles double-tap prevention.

Before:
```tsx
onClick={(e) => {
  if (e.detail > 0 && !('ontouchstart' in window)) {
    handleBack();
  }
}}
onTouchStart={handleTouchStart}
onTouchEnd={handleTouchEnd}
```

After:
```tsx
onClick={handleBack}
```

Remove the `touchStartRef`, `handleTouchStart`, and `handleTouchEnd` code entirely since they are no longer needed.

### No changes needed to `button.tsx`

The Button component already has `touch-manipulation` in its base classes (line 8), which is the correct and sufficient fix for mobile double-tap delay. No modifications needed.

## Why This Works

- `touch-manipulation` (already present) tells the browser: "this element doesn't use pinch-zoom or double-tap-zoom, so fire click events immediately without waiting 300ms." This is the W3C-standard solution.
- Removing `background-color: inherit !important` stops the browser from fighting with Tailwind's hover classes on every interaction.
- Simplifying BackButton's onClick means it works on all devices regardless of touch capability.

## Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Remove hover background/transition overrides from `@media (hover: none)` block |
| `src/components/BackButton.tsx` | Replace custom touch handling with simple `onClick={handleBack}` |

