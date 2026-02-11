

# Stabilization and Alignment Pass

## Issue Group 1 -- Customer Checkout Fails to Create Order

**Root Cause:** The `create-draft-order` edge function performs many sequential operations (local order insert, seller lookups, order_items insert, Shopify draft order creation). If any step is slow (especially the Shopify Admin API call), the function can exceed timeout limits. Additionally, the edge function was recently modified and may need redeployment to pick up changes.

The frontend code in `Checkout.tsx` (lines 207-292) has proper error handling with try/catch/finally, so it should not get stuck infinitely. However, if the edge function response takes too long, the browser may drop the connection, leaving `isSubmitting` stuck at `true` because `finally` never fires (the promise never resolves/rejects).

**Fix:**
- Redeploy the `create-draft-order` edge function to ensure the latest code is active.
- Add a client-side timeout wrapper around the `supabase.functions.invoke` call (e.g., 30 seconds), so the UI always recovers even if the backend hangs.
- In `Checkout.tsx`, wrap the invoke call with `Promise.race` against a timeout to guarantee the loading state resolves.

---

## Issue Group 2 -- Checkout Back Navigation Loop

**Root Cause:** The Checkout page back button (line 303) uses `navigate('/cart')` which **pushes** a new history entry. So the history becomes: `Product -> Cart -> Checkout -> Cart (new push)`. Then Cart's back button (line 25) uses `navigate(-1)` which goes to Checkout. Then Checkout's back goes to Cart again. Infinite loop.

**Fix:**
- In `Checkout.tsx`, change the back button from `navigate('/cart')` to `navigate(-1)` so it goes back in history instead of pushing a new entry. This breaks the loop and allows the user to eventually reach the product page.

---

## Issue Group 3 -- Seller Portal Order Organization

**Root Cause:** The `SellerOrders.tsx` page currently sorts by `created_at` (newest first) by default. Orders are displayed in a flat list without date grouping.

**Fix:**
- Change the default sort to `pickup-soonest` instead of `newest`.
- Add visual date group headers (Today, Tomorrow, Upcoming, Completed/No-Show at bottom).
- In the `filteredOrders` memo, group orders by pickup date and separate completed/no-show orders to the bottom.

---

## Issue Group 4 -- Homepage Routing and Collection Logic

**4A: "View All" button** links to `/shop?vendor=luut-slu` but Shop.tsx doesn't handle this query param.

**Fix:** Change the "View All" link in `Index.tsx` (line 126) to point to the LUUT SLU seller profile page: `/seller/b9006c53-6e26-4d79-8885-fd63f5d919e1`. This shows the actual Luut SLU storefront with seller info and products.

**4B: "New Arrivals"** links to `/shop?filter=new` but Shop.tsx ignores query params.

**Fix:** Create a handler in `ShopCategory.tsx` or add a route `/shop/new-arrivals` that fetches products sorted by `created_at` (newest first from Shopify Storefront API using `sortKey: CREATED_AT, reverse: true`).

**4C: "Best Sellers"** links to `/shop?filter=best`.

**Fix:** Route to a page that uses the existing `weekly_best_sellers` view. Link the "Best Sellers" button to a dedicated path like `/shop/best-sellers` that renders the best sellers data from the existing `useBestSellers` hook in a full-page grid format.

---

## Issue Group 5 -- Seller Profile and Seller Portal Linking

**Root Cause:** Product cards and product detail pages link to seller profiles using a slug pattern like `/seller/luut-slu`, but the `SellerProfile.tsx` route queries by UUID (`id`). Since `id` is a UUID like `b9006c53-...`, the slug-based lookup fails and shows "Seller not found".

**Fix:**
- Update `SellerProfile.tsx` to support both UUID and slug-based lookups. When `sellerId` param is not a valid UUID format, query `seller_profiles` by matching a normalized slug against `seller_name` (lowercase, spaces to hyphens).
- Add a "View My Public Profile" link in the seller portal nav (`SellerNav.tsx`) that links to `/seller/{profile.id}`.
- The "Contact Seller" button on the seller profile page currently uses the generic WhatsApp ChatButton. Change it to open WhatsApp with the specific seller's WhatsApp number.

---

## Issue Group 6 -- Product Share Link Flow

**Root Cause:** No seller attribution exists in product URLs. Products link to `/product/{handle}` without any seller context.

**Fix:**
- Add an optional `?ref={sellerId}` query parameter to product URLs.
- In `ProductDetail.tsx`, read the `ref` param and store it in the cart item when adding to cart, so checkout can route the WhatsApp message to the correct seller.
- In the seller portal product list (`SellerProducts.tsx`), add a "Copy Share Link" button for each product that generates a URL like `/product/{handle}?ref={sellerId}`.
- In `Checkout.tsx`, use the seller reference from cart items to determine the WhatsApp number for the order notification.

---

## Issue Group 7 -- General Stability and UX

**7A: Mobile double-tap**

**Root Cause:** The current CSS fix in `index.css` only removes `transition` on hover for touch devices, but doesn't prevent the hover pseudo-class from activating. iOS Safari still enters the hover state on first tap. The `button.tsx` variants still include `hover:bg-primary/90`, `hover:bg-accent`, etc. which trigger on first touch.

**Fix:** The CSS needs to actually neutralize the hover background changes, not just the transition. Update the `@media (hover: none)` block to override the hover background/color changes:
```css
@media (hover: none) {
  button:hover, a:hover, [role="button"]:hover {
    background-color: inherit !important;
    color: inherit !important;
  }
}
```

However this is too aggressive. Better approach: add `@media (hover: hover)` conditionals around the hover styles in `button.tsx` using Tailwind's built-in support. Tailwind doesn't natively support `@media (hover: hover)` as a variant, so the cleanest fix is the CSS override approach targeting specific problematic selectors.

**7B: Infinite loading after checkout**

Already addressed by Issues 1 and 2 (timeout wrapper + navigation fix).

**7C: Seller portal reload loops**

Already addressed in previous fix round with `lastFetchedId` ref in `useSellerOrders.ts`. Will verify the fix is working correctly.

---

## Summary of Files to Change

| File | Issues Fixed |
|------|-------------|
| `src/pages/Checkout.tsx` | 1 (timeout wrapper), 2 (back nav fix) |
| `src/pages/Index.tsx` | 4A (View All link), 4B/4C (New Arrivals/Best Sellers links) |
| `src/pages/SellerProfile.tsx` | 5 (slug-based lookup support, seller-specific WhatsApp) |
| `src/pages/seller/SellerOrders.tsx` | 3 (pickup date grouping) |
| `src/pages/ProductDetail.tsx` | 6 (read ref param, seller attribution) |
| `src/pages/seller/SellerProducts.tsx` | 6 (share link button) |
| `src/components/seller/SellerNav.tsx` | 5 (public profile link) |
| `src/pages/ShopCategory.tsx` | 4B/4C (new-arrivals/best-sellers routes) |
| `src/index.css` | 7A (mobile double-tap override) |
| `src/App.tsx` | 4B/4C (new routes) |
| `supabase/functions/create-draft-order/index.ts` | 1 (redeploy) |

**No database changes required.**
