

# Seller Portal Stability, Sellers Directory, and Mobile UX Fixes

This plan addresses all reported issues in a single pass with targeted fixes.

---

## ISSUE H1 -- Seller order creation fails on first attempt

**Root Cause:** The `CreateOrderDialog` code looks correct after the previous fix round. However, examining the flow more carefully, the issue is that `onOrderCreated?.()` on line 263 calls `refetch` which triggers `fetchOrders` in `useSellerOrders`. This refetch races with the dialog closing and can cause a state update on an unmounted component. Additionally, the `product_sales` insert (line 249) doesn't handle errors -- if it throws due to a constraint violation, the outer catch fires and shows "Failed to create order" even though the order WAS created.

**Fix:**
- In `CreateOrderDialog.tsx`: Make the `product_sales` insert and stock deduction non-blocking (catch errors individually without failing the whole operation). Close the dialog and call `onOrderCreated` only after the order and order_items are confirmed created. Treat sales recording and stock deduction as best-effort.

---

## ISSUE H2 -- Orders view does not retain selected filters/tabs

**Root Cause:** Filter state (`statusFilter`, `sortBy`, `searchQuery`) in `SellerOrders.tsx` is stored in component-level `useState`. When navigating to an order detail and back, the component unmounts and remounts, resetting all state.

**Fix:**
- Use URL search params (`useSearchParams`) to persist filter/sort state across navigation. When a filter changes, update the URL. On mount, read from URL params.

---

## ISSUE H3 -- Cannot archive/hide completed orders

**Root Cause:** No archive feature exists.

**Fix:**
- Add a `hidden_orders` key in `localStorage` (per seller) that stores an array of hidden order IDs.
- Add an "Archive" button to the order detail sidebar and a bulk-select option on the orders list.
- Add a toggle to show/hide archived orders in the filter bar.
- No database changes needed -- this is a client-side filter.

---

## ISSUE H4 -- Seller Portal mobile view not usable

**Root Cause:** The orders table uses a standard HTML `<Table>` with 8 columns including an Actions column with 3 icon buttons. On mobile, this overflows and requires horizontal scrolling.

**Fix:**
- Replace the table layout on mobile with a card-based layout using responsive classes.
- Each card shows: Customer name/phone (top), Item(s) + Status (middle row), Pickup date + Location (bottom row), Total as a small badge.
- Order number becomes the least prominent element.
- The entire card is tappable to open order details.
- Keep the desktop table layout unchanged.

---

## ISSUE H5 -- Seller portal infinite reload/loop

**Root Cause:** The `SellerOrderDetail` page calls `useSellerOrders(profile?.id)` which fetches ALL orders. When `profile` is initially undefined (loading), it doesn't fetch. When profile loads, it triggers a fetch. If `useSellerProfile` re-triggers due to auth state changes, the orders hook re-fetches, causing a cascading reload.

**Fix:**
- Add a stable reference check in `useSellerOrders` so it doesn't re-fetch if `sellerProfileId` hasn't actually changed.
- In `useSellerProfile`, stabilize the auth listener to not trigger redundant profile fetches.

---

## ISSUE H6 -- Analytics shows incorrect revenue data

**Root Cause:** The `SellerAnalytics` page queries `product_sales` table which records ALL sales at creation time (not just completed). The `SellerOrders` page stats correctly count only completed orders for revenue. But the Analytics page counts everything.

**Fix:**
- In `SellerAnalytics.tsx`, add a label clarification: rename "Revenue" to "Potential Revenue" (all recorded sales).
- Add a separate "Actual Revenue" stat that cross-references with completed orders only (join `product_sales` with `orders` where status = 'completed').
- Alternatively, since `useSellerStats` already computes correct revenue from completed orders, reuse that data on the analytics page.

---

## ISSUE H7 -- Pickup date shifts one day earlier

**Root Cause:** The `CreateOrderDialog` stores `preferredDate` as `yyyy-MM-dd` from the date input (line 197). When this date string is stored in the database and later parsed with `new Date("2026-02-10")`, JavaScript interprets it as UTC midnight. When displayed in a timezone behind UTC (like Caribbean / AST = UTC-4), it shows as February 9th.

**Fix:**
- In `CreateOrderDialog.tsx`: Store the date as a formatted text string (e.g., "Monday, February 10, 2026") to match the system's canonical format, avoiding timezone interpretation issues.
- In `SellerOrders.tsx` and `SellerOrderDetail.tsx`: Display `preferred_date` as-is (it's already a formatted string), without re-parsing through `new Date()`.

---

## ISSUE H8 -- Missing advanced filtering for orders

**Fix:**
- Add filter dropdowns for: Location, Pickup Date (with "Today" shortcut), and Product/Item.
- These filters integrate with the URL search params from H2 so they persist.
- Filter options are derived dynamically from the existing orders data.

---

## ISSUE I1/I2 -- Sellers page is empty

**Root Cause:** The Sellers page queries `verified_sellers` table which is a separate, empty table. Actual sellers are in `seller_profiles` with `is_approved = true`.

**Fix:**
- Change `Sellers.tsx` to query `seller_profiles` where `is_approved = true` instead of `verified_sellers`.
- Map the seller_profiles fields to match the display (seller_name as name, shop_description as description, location, phone).

---

## ISSUE I3/I4 -- Missing seller storefront pages

**Root Cause:** `SellerProfile.tsx` queries `verified_sellers` (empty) and shows a placeholder "Products coming soon" message.

**Fix:**
- Update `SellerProfile.tsx` to query `seller_profiles` instead of `verified_sellers`.
- Query `seller_products` for that seller's active products and display them in a product grid.
- Show seller logo (if available), name, description, location.
- For LUUT SLU (admin seller), also fetch Shopify products by vendor name and display them alongside local products.
- Make seller URLs use the seller profile ID: `/seller/:sellerId`.

---

## MOBILE DOUBLE-TAP ISSUE -- Buttons require double tap

**Root Cause:** The `hover:bg-accent` and `hover:bg-primary/90` CSS classes in the button component trigger a hover state on first tap in mobile Safari. iOS Safari implements a "hover-then-click" pattern where the first tap activates `:hover` and the second tap fires `click`.

**Fix:**
- Add a `@media (hover: hover)` wrapper in CSS so hover styles only apply on devices that support true hover (desktop with mouse).
- Modify button variants in `button.tsx` to use `@media(hover:hover)` conditional hover classes, or add a global CSS rule that disables hover effects on touch devices.
- The simplest approach: add a CSS rule in `index.css`:
  ```css
  @media (hover: none) {
    button, a, [role="button"] {
      -webkit-tap-highlight-color: transparent;
    }
  }
  ```
  And update button variants to use Tailwind's `hover:` with the `@media (hover: hover)` modifier. Tailwind supports this via custom variant or by adding a global override.

---

## Summary of Files to Change

| File | Issues Fixed |
|------|-------------|
| `src/components/seller/CreateOrderDialog.tsx` | H1, H7 (error handling, date format) |
| `src/pages/seller/SellerOrders.tsx` | H2, H3, H4, H8 (URL params, archive, mobile cards, filters) |
| `src/pages/seller/SellerOrderDetail.tsx` | H3 (archive button), H7 (date display) |
| `src/hooks/useSellerOrders.ts` | H5 (stable fetch reference) |
| `src/pages/seller/SellerAnalytics.tsx` | H6 (revenue labels) |
| `src/pages/Sellers.tsx` | I1, I2 (query seller_profiles) |
| `src/pages/SellerProfile.tsx` | I3, I4 (seller storefront with products) |
| `src/index.css` | Mobile double-tap fix |
| `src/components/ui/button.tsx` | Mobile double-tap fix (hover variant) |

**Database changes:** None required. The `verified_sellers` table can remain but will no longer be queried by the frontend.

