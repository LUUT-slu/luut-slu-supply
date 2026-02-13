

# Fix Plan: WhatsApp Messages, Time Slots, Admin Notification, and Freezes

---

## 1. Fix Prefilled WhatsApp Messages Across Flows

### Issues Found

Several WhatsApp buttons send incorrect or context-less messages:

**A) Seller Order Detail -- "Message Customer" button (SellerOrderDetail.tsx line 101-102)**
Opens `wa.me/1{phone}` with NO prefilled message. The customer gets a blank chat. Also incorrectly prepends `1` to the phone number (what if it already has the country code?).

**Fix:** Add a contextual prefilled message with the order number, seller name, and pickup details. Clean the phone number properly (strip non-digits, don't blindly prepend `1`).

**B) WhatsAppButton.tsx (generic component)**
Default message is `"Hi! I'm interested in shopping on Luut SLU."` -- this is fine for a general contact button, but it's used on seller profile pages where it should say something seller-specific.

**Fix:** No change needed here -- callers already pass custom `message` props where needed.

**C) Partner Dashboard -- "Contact Customer" (PartnerDashboard.tsx line 274-276)**
Uses `order.customer_phone.replace(/\D/g, '')` which strips the phone to just digits, but doesn't add a country code. A local number like `758-123-4567` becomes `7581234567` which is incomplete for international wa.me links.

**Fix:** Normalize phone numbers consistently: if the number has 7 or 10 digits, prepend `1` for the country code. If it already starts with `1` and has 11 digits, use as-is.

**D) CartDrawer.tsx (line 285-296)**
The WhatsApp message says "NEW ORDER" but doesn't include the seller's name or the order number clearly. This is adequate but could be improved.

**Fix:** Minor -- no critical issue here.

### Files to Change
- `src/pages/seller/SellerOrderDetail.tsx` -- Fix "Message Customer" to include order context
- `src/pages/PartnerDashboard.tsx` -- Fix phone number normalization

---

## 2. Add Time Slots to Seller Portal Order Creation

### Current State
`CreateOrderDialog.tsx` only has a date input (`type="date"`). No time slot selection exists.

### Fix
Add a time slot dropdown after the date picker with options like:
- Morning (9 AM - 12 PM)
- Afternoon (12 PM - 3 PM)
- Evening (3 PM - 6 PM)
- Flexible / Any Time

Store the selected time slot in the `pickup_time` column (already exists in the `orders` table).

### Files to Change
- `src/components/seller/CreateOrderDialog.tsx` -- Add time slot select, include in order insert

---

## 3. Admin Notification on Seller Application

### Current State
When someone clicks "Submit Application" in `SellerApply.tsx`, a `seller_profiles` row is created with `seller_status: "pending"` and `is_approved: false`. The admin is NOT notified -- they have to manually check the admin panel.

### Fix
After successfully inserting the seller profile, auto-open a WhatsApp message to the admin (17587185478) with the application details. This ensures the admin is notified immediately.

### Files to Change
- `src/pages/seller/SellerApply.tsx` -- Add WhatsApp notification to admin after successful submission

---

## 4. Website Freeze Prevention

### Root Causes Identified

**A) CSS `background-color: inherit !important` on hover (index.css line 166)**
The current mobile double-tap fix uses `background-color: inherit !important` which can cause unexpected rendering when `inherit` resolves to `transparent` on nested elements, potentially causing visual glitches and perceived "freezes" where buttons appear non-functional.

**Fix:** Change `inherit` to `unset` or remove the background override and instead use `pointer-events` management. Actually the better fix is to keep it but also apply to `.cursor-pointer` selector which was missed in the hover rules.

**B) Checkout timeout already implemented (30s)**
This looks correct from the previous fix round.

**C) useSellerOrders stable ref**
Already has the `lastFetchedId` guard. This looks correct.

The main remaining freeze scenario is the CSS hover issue on mobile causing perceived non-responsiveness (buttons don't visually respond on first tap, making users think the site is frozen).

### Files to Change
- `src/index.css` -- Refine the hover override to also cover `.cursor-pointer:hover`

---

## Summary of All Changes

| File | Change |
|------|--------|
| `src/pages/seller/SellerOrderDetail.tsx` | Fix "Message Customer" WhatsApp with contextual message and proper phone normalization |
| `src/pages/PartnerDashboard.tsx` | Fix customer phone normalization for wa.me links |
| `src/components/seller/CreateOrderDialog.tsx` | Add pickup time slot selector |
| `src/pages/seller/SellerApply.tsx` | Send WhatsApp notification to admin on application submit |
| `src/index.css` | Refine mobile hover fix to cover `.cursor-pointer` elements |

No database changes required. The `pickup_time` column already exists in the `orders` table.

