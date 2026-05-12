# Purchase Orders — Plan

A simple, mobile-first Purchase Order (PO) system for Admin and Sellers. Tracks incoming stock, cost vs. selling price, expected profit, smart tags, arrival confirmation, and (admin-only) Shopify publish/sync. Shows up on Admin and all Seller dashboards.

## Scope

In:
- PO CRUD with line items, auto-calculated totals/margins
- Statuses: Draft, Ordered, Paid, In Transit, Arrived, Partially Arrived, Published, Selling, Completed, Cancelled
- Confirm Arrival flow (arrived/missing/damaged qty, actual date)
- Smart tags (manual + auto rules), editable
- Buying insights from past POs (last cost/sell, avg margin, sell-through, recommendation)
- PO summary card + 3 reports (PO Report, Weekly Review, Product Performance)
- Sales matching against existing `orders` / `order_items` and `product_sales`
- Admin-only Shopify create/update via existing `SHOPIFY_ADMIN_TOKEN` (writes select fields to `luut_purchase` metafields, never exposes cost)
- Sellers: own PO, submit-for-review, no direct Shopify publish

Out (explicitly):
- Barcodes, SKUs, multi-warehouse, complex inventory transfers
- Customer-facing changes
- Editing existing checkout/order flows

## Database (new tables, all RLS-protected)

`purchase_orders`
- id, owner_user_id, owner_role ('admin'|'seller'), seller_profile_id (nullable)
- name, supplier_name, supplier_link, date_ordered, expected_arrival_date, actual_arrival_date
- payment_status ('unpaid'|'partial'|'paid'), status (enum of 10 above, default 'draft')
- notes, created_at, updated_at
- Generated/aggregated columns updated by trigger: total_cost, total_expected_revenue, total_expected_profit, avg_margin

`purchase_order_items`
- id, purchase_order_id, product_name, category, sub_category
- quantity_ordered, quantity_arrived (default 0), quantity_missing, quantity_damaged
- cost_per_item, selling_price
- image_url, supplier_link, color, size, brand, notes
- linked_seller_product_id (nullable FK to seller_products), shopify_product_id, shopify_variant_id
- shopify_sync_status, shopify_synced_at, shopify_publish_state ('hidden'|'coming_soon'|'draft'|'active')
- Generated columns: total_cost, expected_revenue, expected_profit, profit_margin

`purchase_order_item_tags`
- id, item_id, tag (text), source ('manual'|'auto'), created_at

`purchase_order_events` (audit: created, status changed, arrival confirmed, published, etc.)

RLS:
- Admin: full access (via `has_role(auth.uid(),'admin')`)
- Seller: only rows where `owner_user_id = auth.uid()`
- No public/anon access

Indexes on `(owner_user_id, status)`, `(category, sub_category)`, `(shopify_product_id)`.

## Key RPCs / Edge Functions

- `rpc_po_recalculate(po_id)` — recalc totals after item changes (also via triggers).
- `rpc_po_confirm_arrival(po_id, arrivals[])` — sets per-item arrived/missing/damaged, actual_arrival_date, flips status to Arrived/Partially Arrived, logs event.
- `rpc_po_apply_auto_tags(po_id)` — runs auto-tag rules for items in PO.
- `rpc_po_buying_insights(product_name, category)` — returns last cost, last sell, avg margin, total sold, restock count, recommendation string.
- Edge function `po-publish-to-shopify` (admin-only, verify_jwt=false + manual admin check using service role): create or update Shopify product via Admin API, set price/inventory/tags, write `luut_purchase` metafields (cost, qty_ordered, qty_arrived, expected_profit, margin, supplier — admin-only namespace, no storefront exposure), save IDs back to item.
- Edge function `po-sales-rollup` (cron-able, manual trigger button): joins `order_items` + `product_sales` to PO items by `shopify_product_id`/`linked_seller_product_id`/name+category fallback; updates derived "sold qty / revenue / days-to-sell / sell-through" cached on item.

## Auto-tag rules (server-side in `rpc_po_apply_auto_tags`)
- margin ≥50% → High ROI; 30–49% → Good margin; <25% → Low ROI
- cost < 50% of user's avg cost → Cheap item
- selling_price > 150% of user's avg → Premium item
- ≥50% sold within 7d of arrival → Quick seller
- <20% sold after 14d → Slow seller
- remaining ≤3 → Limited stock
- first time product+category for this owner → Test product
- prior PO with same product → Restock again
- repeat strong sales (e.g., ≥2 prior POs all sold ≥80%) → Best seller
Manual override: any auto tag can be deleted; manual tags additive.

## Frontend

New routes (lazy-loaded):
- Admin: `/admin/purchase-orders`, `/admin/purchase-orders/:id`, `/admin/purchase-orders/new`, `/admin/purchase-orders/reports`
- Seller: `/seller/purchase-orders`, `/seller/purchase-orders/:id`, `/seller/purchase-orders/new`

Shared components in `src/components/purchase-orders/`:
- `POList` — cards with status chip, totals, expected arrival, ROI counts
- `POForm` — header fields + items repeater, mobile-friendly
- `POItemRow` — name/qty/cost/sell with live profit/margin, image upload, tag chips, inline buying-insight popover
- `POSummaryCard` — totals + risk/ROI counts
- `ConfirmArrivalDialog` — per-item arrived/missing/damaged
- `PublishShopifyDialog` (admin) — choose hidden / coming soon / draft / active, push to Shopify
- `BuyingInsightHint` — surfaces past-PO data on name/category change
- `POReports` — three tabs: PO Report, Weekly Review, Product Performance

Dashboard integration:
- Add "Purchase Orders" card+link to `AdminHome` and to all seller dashboards (`SellerDashboard`, `SellerDashboardNew`) — visible per spec on every seller dashboard.

Mobile-first: stacked layouts, large CTAs (New PO, Add Item, Confirm Arrival, Publish to Shopify, Update Inventory, View Report), touch-friendly inputs, sticky totals on mobile.

Design tokens only (existing black/gold theme, semantic Tailwind tokens). No new color literals.

## Sales matching
- Background reconciliation links `order_items` and `product_sales` to PO items in this priority: shopify_product_id+variant → shopify_product_id → linked_seller_product_id → normalized (product_name + category). Cached aggregates on item: qty_sold, revenue, profit_actual, first_sold_at, last_sold_at, days_to_50pct.

## Shopify safety
- Only admin can publish/update; sellers' "submit for review" creates an internal flag, no API call.
- Cost/supplier never written to public fields; only inside `luut_purchase` metafields (admin namespace) plus product notes hidden from theme.
- If `shopify_product_id` exists → update; else create. Save returned IDs.

## Out-of-scope confirmations
- No changes to checkout, customer flows, existing order lifecycle, or auth.
- No new secrets needed (`SHOPIFY_ADMIN_TOKEN` already configured).

## Rollout steps
1. Migration: tables, enums, RLS, triggers for totals, indexes.
2. RPCs: insights, confirm arrival, auto-tags.
3. Edge functions: `po-publish-to-shopify`, `po-sales-rollup`.
4. Shared UI components + admin routes.
5. Seller routes + submit-for-review.
6. Reports tab.
7. Dashboard entry points (Admin + every seller dashboard).
8. QA: mobile layout, RLS isolation, Shopify create/update idempotency, metafield write, sales matching accuracy.
