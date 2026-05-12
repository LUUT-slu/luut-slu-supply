## Goal
Make Shopify POS / Online orders that are imported into the website appear in the correct seller's dashboard, broken down per seller, while admin still sees the full parent order.

## Key insight
The website already supports per-seller order visibility through `order_items.seller_id`:
- `useSellerOrders` queries `order_items` where `seller_id = sellerProfileId`, then loads parent orders.
- RLS policy "Sellers can view own order items" + "Sellers can view orders containing their items" already enforces that sellers only see their own items.

So I do NOT need a new `seller_orders` table. I need to:
1. Populate `order_items.seller_id` correctly when the Shopify sync writes line items.
2. Add a `source` indicator on the order so seller UIs can filter.

## Plan

### 1) Match Shopify line items to website sellers (in `sync-shopify-orders/index.ts`)
For each imported line item, resolve a `seller_id` (FK to `seller_profiles.id`) using this priority:
1. `seller_products.shopify_product_id == lineItem.variant.product.id`
2. Fallback: match by SKU on `seller_products` (add a lookup helper if SKU exists; today seller_products has no SKU column — skip if absent).
3. Fallback: case-insensitive match on `seller_products.name == lineItem.title`.
4. If nothing matches → leave `seller_id = null` (admin-only) and record a structured warning in `skip_details` with reason `Product not assigned to seller` (do not count as a skipped order — the order still imports).

Cache `shopify_product_id → seller_id` and `name → seller_id` lookups per sync run to avoid N queries.

Also set `product_id` on the order_item when the matched `seller_products` row is found, so future analytics work.

### 2) Persist attribution on `order_items`
When inserting the order_items snapshot (existing block at lines 316–335), include:
- `seller_id` (resolved above, nullable)
- `product_id` (resolved above, nullable)
- existing shopify_line_id / shopify_variant_id / shopify_product_id

The existing delete-and-reinsert pattern already handles re-sync updates idempotently. Dedupe per (order_id, shopify_line_id) is implicit because we wipe and re-insert.

### 3) Seller-side display
- `useSellerOrders` already filters by `seller_id` — no change needed for visibility.
- `SellerOrders` page: add filter chips:
  - All
  - Website
  - Shopify POS
  - Shopify Online
  - Completed
  Driven by `order.source` (`website` / `shopify_pos` / `shopify_online` / `manual`) and `order.order_status`.
- Show a small "Shopify POS Sale" / "Shopify Online" badge on imported rows.
- For imported Shopify orders the seller view is read-only (no status edits, no delete) since the sale already happened externally.

### 4) Sync log enrichment (`AdminOrdersPage.tsx` panel + edge function summary)
Extend the sync result with per-line counters:
- `lineItemsTotal`
- `lineItemsMatchedToSeller`
- `lineItemsUnassigned` (with sample `{ shopify_order_name, line_title, shopify_product_id }`)
- `sellerOrdersCreated` = number of distinct (order, seller) pairs touched
Show these in the existing "Last Shopify Sync" card.

### 5) Avoid duplicates / re-runs
Continue using `shopify_order_id` as parent dedupe (already implemented).
For line items, the wipe-and-reinsert per order is correct because Shopify is the source of truth; this naturally implements "(shopify_line_id + seller) is unique".

### 6) Status mapping for seller view
Seller-facing status for imported Shopify orders is the parent `order_status`:
- `COMPLETED` for paid / fulfilled / POS → shown as "Completed POS Sale" or "Completed Online Sale" depending on `source`.
- `CANCELLED` for refunded/voided.
- Otherwise `NEW`.
No new column needed.

## Files to change
- `supabase/functions/sync-shopify-orders/index.ts` — add seller matcher, set `seller_id`/`product_id` on order_items, expand summary.
- `src/hooks/useShopifySyncStatus.ts` — extend `ShopifySyncResult` with line-item counters and unassigned samples.
- `src/pages/AdminOrdersPage.tsx` — show new line-item/seller stats in sync log panel.
- `src/pages/seller/SellerOrders.tsx` — add source filter chips and source badge; lock editing for Shopify-imported orders.
- (Optional) `src/hooks/useSellerOrders.ts` — expose `source` on returned orders so the page can filter (already passes `...order` so likely already there).

## Out of scope
- No schema changes (uses existing `order_items.seller_id`, `orders.source`, `orders.shopify_order_id`).
- No new seller_orders table; `order_items` already serves the split-per-seller need.
- Commission calculation for Shopify POS sales — left for later.
