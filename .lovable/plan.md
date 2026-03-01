

## Plan: Website + Checkout + Promo Fixes

This is a large multi-part update covering 6 areas: countdown timer, multi-seller cart, time slot picker, discount validation fix, WhatsApp button label, and order status flow.

---

### 1. Countdown Timer (Banner + Popup)

**Problem**: Banner shows static "7 days" text instead of a live countdown.

**Solution**: Create a reusable `useCountdown` hook that computes remaining time from the popup's `endAt` datetime (already stored in `site_settings.popups[].endAt`). The popup currently has `endAt: null` — admin must set it via Site Settings (it's already March 7 per the Shopify price rule).

**Changes**:
- **New: `src/hooks/useCountdown.ts`** — Hook that takes an end date and returns `{ days, hours, minutes, seconds, isExpired }`, updating every second.
- **`src/components/SaleBanner.tsx`** — Replace "7 days" with countdown: `"ENDS IN: 5D 03H 12M"`. If expired, hide banner.
- **`src/components/SalePopup.tsx`** — Add countdown line below subtitle: `"Ends in: 5D 03H 12M"`.
- **Database update** — Set the popup's `endAt` to `2026-03-07T17:30:59Z` (matching Shopify price rule expiry).

---

### 2. Multi-Seller Cart Support

**Problem**: `cartStore.addItem()` blocks adding items from different vendors.

**Solution**: Remove the single-seller enforcement from the cart store. The existing `create-draft-order` edge function already handles seller attribution per line item via `order_items` table. Seller portal already filters by `seller_id`. Use approach **B** (single order, internal routing per seller).

**Changes**:
- **`src/stores/cartStore.ts`** — Remove `currentSeller` state and the vendor check in `addItem()`. Keep `getCurrentSeller()` as a computed value (first item's vendor or null) for display purposes only.
- **`src/pages/Cart.tsx`** — Update seller indicator to show multiple sellers if items span vendors: "Shopping from Seller A, Seller B" or remove the single-seller badge in favor of per-item vendor labels.
- **`src/pages/Checkout.tsx`** — Remove `getCurrentSeller()` usage for WhatsApp routing; instead, if multiple vendors, route to fallback merchant number. WhatsApp message lists items with vendor attribution per line.

---

### 3. Pickup Time Slot Picker

**Problem**: No time slot collection at checkout; requires WhatsApp follow-up.

**Changes**:
- **Database migration** — The `orders` table already has `pickup_time` column. No schema change needed.
- **`src/pages/Checkout.tsx`** — Add a new `ChecklistItem` for "Pickup Time Slot" with a `Select` dropdown of 30-min increments from 9:00 AM to 5:00 PM. Make it required for form completion. Save to `pickup_time` field.
- **`supabase/functions/create-draft-order/index.ts`** — Accept `pickupTime` in the request body, save to `orders.pickup_time`, include in Shopify note and WhatsApp message.
- **WhatsApp message** — Add `⏰ Pickup Time: [selected time]` line.
- **Order confirmation page** — Show the selected pickup time in meetup details.

---

### 4. Discount Code Validation Fix

**Problem**: "1KPROMO" returns "could not validate discount code".

**Root cause analysis**: The `validate-discount` edge function uses Shopify's `/discount_codes/lookup.json` endpoint which returns a 303 redirect. The `redirect: "follow"` is set but the function might not be deployed or the Shopify lookup may require handling the redirect response differently.

**Changes**:
- **`supabase/functions/validate-discount/index.ts`** — Debug and fix the lookup. The redirect handling may strip the auth header on redirect. Fix by manually following the redirect URL while preserving the `X-Shopify-Access-Token` header. Also ensure the function is deployed.
- **Test** — Deploy and call the function with `1KPROMO` to verify.

---

### 5. WhatsApp Button Label Change

**Problem**: After order, button says "Open WhatsApp Again" instead of "Confirm With Seller".

**Changes**:
- **`src/pages/OrderConfirmed.tsx`** — Change button text from `"Open WhatsApp Again"` to `"Confirm With Seller"`. First-time button stays `"Message Seller on WhatsApp"`. Add a small confirmation hint after WhatsApp opens: "WhatsApp opened. Please send the message to confirm."
- The order status is already NOT set to completed by this flow (it stays `pending`). No status change needed.

---

### 6. `/discount/1KPROMO` Route

**Changes**:
- **`src/App.tsx`** — Add route `/discount/:code` that saves the discount code to sessionStorage and redirects to `/shop`.
- **`src/pages/Checkout.tsx`** — On mount, check sessionStorage for a saved discount code and auto-apply it.

---

### Implementation Order

1. Fix discount validation edge function (most critical — blocks sale launch)
2. Add countdown hook + update banner/popup
3. Remove single-seller cart enforcement
4. Add pickup time slot to checkout
5. Update WhatsApp button labels on OrderConfirmed
6. Add `/discount/:code` route
7. Update `site_settings.popups` endAt in database

### Files Created
- `src/hooks/useCountdown.ts`

### Files Modified
- `src/stores/cartStore.ts`
- `src/components/SaleBanner.tsx`
- `src/components/SalePopup.tsx`
- `src/pages/Checkout.tsx`
- `src/pages/OrderConfirmed.tsx`
- `src/pages/Cart.tsx`
- `src/App.tsx`
- `supabase/functions/validate-discount/index.ts`
- `supabase/functions/create-draft-order/index.ts`

