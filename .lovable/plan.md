
# Full-Screen Cart Page Implementation

## Overview
Convert the current side-drawer cart (`CartDrawer.tsx`) into a dedicated full-screen cart page at `/cart`. When users click "Add to Cart", they'll navigate to this full-page cart experience instead of opening a slide-over panel.

---

## What Will Change

### User Experience
- **Add to Cart** now navigates to `/cart` (full-screen page)
- Cart feels like a real checkout step, not a casual pop-up
- Back arrow navigation (like any normal page)
- Sticky "Checkout" button on mobile for constant visibility

### What Stays the Same
- All existing cart logic (Zustand store, single-seller enforcement)
- Order builder/checkout flow (meetup details form)
- Shopify draft order creation
- WhatsApp confirmation flow

---

## Implementation Plan

### 1. Create Cart Page Component
**New file: `src/pages/Cart.tsx`**

A full-screen page with:
- **Header**: Back arrow + "Cart" title
- **Empty State**: 
  - "Your Cart is Empty" title
  - "Add an item to continue." subtitle
  - "Back to Shop" button → `/shop`
- **Cart Items View** (when items exist):
  - Scrollable item list (reuse existing item rendering)
  - Seller indicator badge
  - Quantity controls (+/-)
  - Remove item button
  - Order summary (subtotal/total)
- **Sticky Footer**: "Checkout" button → routes to `/checkout`

Layout structure:
```text
┌─────────────────────────────┐
│ ← Cart                      │  ← Header (sticky top)
├─────────────────────────────┤
│                             │
│   [Cart Items - Scrollable] │  ← Body
│                             │
│   ─────────────────────     │
│   Total: EC$XX.XX           │  ← Summary
│                             │
├─────────────────────────────┤
│ [     Checkout     ]        │  ← Footer (sticky bottom)
└─────────────────────────────┘
```

### 2. Create Checkout Page Component
**New file: `src/pages/Checkout.tsx`**

Extracts the "Order Builder" step from `CartDrawer.tsx`:
- Full-screen meetup details form
- All existing form fields (name, phone, location, date, note)
- Deposit acknowledgment checkbox
- "Confirm Order" button
- Same backend logic (create-draft-order, WhatsApp redirect)

### 3. Update Add-to-Cart Behavior

**Files to modify:**
- `src/pages/ProductDetail.tsx`
- `src/components/UnifiedProductCard.tsx`

Changes:
- After `addItem()` succeeds, navigate to `/cart` instead of calling `setCartOpen(true)`
- Remove toast "Added to cart" (navigation is the feedback)

### 4. Update Header
**File: `src/components/Header.tsx`**

- Cart icon click → navigate to `/cart` instead of opening drawer
- Remove `CartDrawer` component import and usage
- Keep badge showing item count

### 5. Add Routes
**File: `src/App.tsx`**

Add two new public routes:
```
/cart → Cart page
/checkout → Checkout page
```

### 6. Deprecate CartDrawer Sheet Behavior
**File: `src/components/CartDrawer.tsx`**

The drawer logic will be refactored:
- Extract reusable components (CartItemCard, EmptyCart)
- Keep as utility file or remove entirely
- The checkout builder logic moves to `/checkout` page

---

## Visual/UX Specifications

| Element | Specification |
|---------|---------------|
| Background | `bg-background` (dark) |
| Header | Sticky, `h-16`, back arrow + title |
| Item cards | `bg-card` with `border-border` |
| Price | `text-primary` (gold accent) |
| Checkout button | Full-width, `size="lg"`, primary variant |
| Footer | Sticky on mobile, `pt-4 border-t` |
| Tap targets | Minimum 44x44px for mobile |

---

## Files Summary

| File | Action |
|------|--------|
| `src/pages/Cart.tsx` | CREATE - Full-screen cart page |
| `src/pages/Checkout.tsx` | CREATE - Meetup details/order builder page |
| `src/App.tsx` | MODIFY - Add `/cart` and `/checkout` routes |
| `src/components/Header.tsx` | MODIFY - Cart icon navigates to `/cart` |
| `src/pages/ProductDetail.tsx` | MODIFY - Navigate to `/cart` after add |
| `src/components/UnifiedProductCard.tsx` | MODIFY - Navigate to `/cart` after add |
| `src/components/CartDrawer.tsx` | KEEP - May extract shared components |

---

## Technical Notes

- No changes to cart store logic or business rules
- All existing Zustand state (items, currentSeller) remains unchanged
- Order creation flow (edge function) stays the same
- Single-seller cart enforcement still works via store
- Form validation logic moves from drawer to checkout page
