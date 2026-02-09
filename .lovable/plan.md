

# Stability and Reliability Fix Plan

This plan addresses all 7 reported issues in a single pass. Each issue has a clear root cause and a targeted fix.

---

## ISSUE 1 -- Order does not confirm on first attempt

**Root Cause:** The `Checkout.tsx` page has an `useEffect` on line 109-113 that watches `items.length` and redirects to `/cart` when the cart is empty. During order submission, `clearCart()` is called on line 280 BEFORE `navigate('/order-confirmed')` on line 281. This triggers the redirect effect, racing with the navigation. On the first attempt, the redirect to `/cart` can win, causing the order to appear to fail even though the backend call may have succeeded.

**Fix:** Move the `clearCart()` call AFTER the navigation, or better yet, use the existing `orderCompletingRef` flag more defensively. The ref is set on line 279 but the effect on line 110 checks it -- the issue is timing. The `clearCart()` triggers a zustand state update which triggers a re-render, which evaluates the effect before the `navigate()` executes. The fix is to ensure `navigate()` is called FIRST, then `clearCart()` is called. Since `navigate` is synchronous in React Router v6 (it schedules navigation), we need to move `clearCart` into a `setTimeout` or use `replace: true` in the navigation.

**Changes:**
- `src/pages/Checkout.tsx`: Reorder the post-success flow -- set the completing ref, navigate first, then clear cart with a brief delay to avoid the race condition.

---

## ISSUE 2 -- Order edits say "updated" but do not persist

**Root Cause:** The `EditOrderDialog.tsx` (seller portal edit) updates the database correctly, but it updates `preferred_date` using `format(date, "yyyy-MM-dd")` (line 103), while the system elsewhere stores dates as full text strings like `"Monday, February 10, 2025"`. This mismatch means the update succeeds but when the data is re-fetched, the date parsing on line 58 (`new Date(order.preferred_date)`) fails because the format changed.

Additionally, the `EditOrderDialog` calls `onSave()` (which is `refetch`) but the `useSellerOrders` hook's `refetch` calls `fetchOrders()` which re-fetches everything from the database -- the data IS persisted, but the date display may look different/broken.

For customer-side edits (OrderDetails.tsx), the `update-order` edge function works correctly with the service role key (bypasses RLS), so this should work. However, there is a potential issue: the edge function updates via `.eq("order_token", orderToken)`, but if the token was never saved to localStorage properly, the update would silently fail with a 404.

**Fix:**
- `src/components/seller/EditOrderDialog.tsx`: Use a consistent date format that matches the rest of the system (full text date string).
- Verify the `update-order` edge function response handling in `OrderDetails.tsx` to ensure errors surface properly.

---

## ISSUE 3 -- Site sometimes freezes on a loading screen

**Root Cause:** The `OrderConfirmed.tsx` page reads `luut-order-confirmed` from localStorage on mount. If the data is missing or expired, it navigates to `/my-orders` (line 36). But this navigation happens inside a `useEffect` with `[navigate]` as dependency. React Router's `navigate` can change reference on re-renders, potentially causing an effect loop. Combined with the cart store race condition from Issue 1, this creates scenarios where the app enters a blank/stuck state.

Also, the `OrderComplete.tsx` page (a separate legacy page at `/order-complete`) has similar auto-redirect logic that can conflict.

**Fix:**
- `src/pages/OrderConfirmed.tsx`: Add a guard to prevent the auto-WhatsApp popup from blocking the page render. Remove the `navigate` dependency from the effect to prevent re-render loops. Add a "loaded" state to prevent flash of null content.
- Clean up the localStorage data properly after consumption to prevent stale redirects.

---

## ISSUE 4 -- Shopify collections not syncing correctly

**Root Cause:** The `ShopCategory.tsx` page passes `categorySlug` to `HybridProductGrid`, which calls `fetchHybridProducts` in `products.ts`. For Shopify products, this uses `getShopifyQueryForSlug()` which constructs a `product_type` query (e.g., `product_type:beanies OR title:beanie`). This does NOT query Shopify collection membership at all -- it queries product types and title keywords. So a collection page shows products matching the product type, not products actually in that Shopify collection.

**Fix:**
- `src/lib/shopify.ts`: Add a new `fetchProductsByCollection` function that queries Shopify's Storefront API using the `collectionByHandle` query, which returns only products that are actually in that collection.
- `src/lib/products.ts`: Update `fetchHybridProducts` to use collection-based queries when a `categorySlug` is provided, falling back to the existing product_type query only for local (Lovable) products.

---

## ISSUE 5 -- Seller order creation gets stuck in loading

**Root Cause:** In `CreateOrderDialog.tsx`, the `handleSubmit` function (lines 155-289) has a problematic pattern: it creates an async IIFE inside `sales.map()` at line 238-246 that generates a Promise as the value for `seller_user_id`. This creates an unresolved Promise object being inserted into an array, which is never awaited. While this particular array is never used (lines 249-270 do the actual sales insert), this pattern reveals fragile async handling.

The real loading issue is that on lines 272-278, stock deduction happens in a sequential `for...of` loop with individual database calls. If any call is slow or fails, the dialog stays in loading state. Combined with the RLS policies, the seller may lack UPDATE permission on `seller_products`, causing the stock deduction to fail silently.

**Fix:**
- `src/components/seller/CreateOrderDialog.tsx`: Remove the unused async IIFE in `sales` array. Wrap the entire submit in proper error handling with `finally` block. Add a timeout/guard to prevent infinite loading.

---

## ISSUE 6 -- Chat widget not working, replace with WhatsApp button

**Root Cause:** The `ChatButton` component currently redirects to `https://lovable-project-yf43m.myshopify.com/pages/chat` which is a Shopify Inbox embed that isn't working.

**Fix:**
- `src/components/ChatButton.tsx`: Replace the Shopify chat URL with a WhatsApp `wa.me` link using the prefilled message "Hi LUUT SLU, I need help with: [type here]".

---

## ISSUE 7 -- Post-order redirect loop and blank white screen

**Root Cause:** The `OrderConfirmed.tsx` page auto-opens WhatsApp via `window.open()` on line 52. On mobile Safari (iPhone), when the user returns from WhatsApp, the browser re-mounts the component and the effect runs again. Since `luut-order-confirmed` is still in localStorage, it re-opens WhatsApp, creating a redirect loop. The "Continue Shopping" and "View My Orders" links are standard `<Link>` components which should work, but the auto-WhatsApp popup re-fires on every page focus/return, overriding the user's intended navigation.

**Fix:**
- `src/pages/OrderConfirmed.tsx`:
  1. Track whether WhatsApp was already auto-opened using a session-level flag (not localStorage, since that persists across the loop).
  2. Only auto-open WhatsApp ONCE, using a `sessionStorage` flag.
  3. Clear the `luut-order-confirmed` localStorage data after reading it (not on page leave, but immediately after consumption).
  4. This prevents the loop: on return from WhatsApp, the data is gone, so the page shows the confirmation without re-triggering WhatsApp.

---

## Summary of Files to Change

| File | Issues Fixed |
|------|-------------|
| `src/pages/Checkout.tsx` | 1 (cart clear race condition) |
| `src/components/seller/EditOrderDialog.tsx` | 2 (date format mismatch) |
| `src/pages/OrderConfirmed.tsx` | 3, 7 (loading freeze, redirect loop) |
| `src/lib/shopify.ts` | 4 (add collection query) |
| `src/lib/products.ts` | 4 (use collection query) |
| `src/components/seller/CreateOrderDialog.tsx` | 5 (async/loading bug) |
| `src/components/ChatButton.tsx` | 6 (WhatsApp replacement) |

No database changes required. No edge function changes required. All fixes are frontend-only, targeting the specific root causes.

