# Unified Order → Shopify Draft Order Flow

Goal: every order created on the website (customer checkout OR seller dashboard) flows through one path that (a) saves the website order, (b) creates a Shopify Draft Order, (c) stores draft-order metadata back on the website order, (d) drives a consistent WhatsApp confirmation lifecycle.

## What already exists
- `supabase/functions/create-draft-order` — customer checkout calls this. It saves `orders`, creates `order_items`, calls Shopify `draft_orders.json`, returns invoice + draft id, fires emails.
- `OrderConfirmed.tsx` — customer WhatsApp confirmation popup (skips for POS).
- `rpc_mark_whatsapp_opened` — flips `communication_status` to `whatsapp_opened`.
- `orders` has `shopify_order_id`, `shopify_order_name`, `shopify_synced_at` (used for completed Shopify orders) but NO draft-order columns and no `order_source` / `created_by_seller_id`.
- `CreateOrderDialog` (seller) inserts into `orders` directly and does NOT call Shopify at all.

## What's missing
1. Seller-created orders never reach Shopify.
2. Draft order id / invoice url / sync status / source / creator are not persisted.
3. No idempotency (re-submitting could double-create drafts).
4. Tagging isn't spec-compliant; no "WhatsApp Confirmed" tag flip.
5. No admin buttons for: Open Shopify draft, Resync, Mark WhatsApp Confirmed, Mark No Response, Cancel, Complete Shopify draft.
6. Seller dashboard has no WhatsApp button + status controls for the new flow.
7. Seller dialog deducts `seller_products.quantity` immediately — spec says don't double-decrement (Shopify does it on completion).

---

## Plan

### 1. Database migration (`orders` + new RPCs)
Add columns to `public.orders`:
- `shopify_draft_order_id text`
- `shopify_draft_order_name text`
- `shopify_draft_order_invoice_url text`
- `shopify_sync_status text` default `'not_synced'` (`draft_created | draft_updated | draft_failed | not_synced | completed`)
- `shopify_sync_error text`
- `order_source text` default `'customer_checkout'` (`customer_checkout | seller_dashboard | shopify_pos | shopify_online | manual`)
- `created_by_seller_id uuid` (nullable, references `seller_profiles.id` logically)

Extend `communication_status` allowed values to include `whatsapp_confirmed` and `no_response` (already in `rpc_set_communication_status` validation — also extend `order_status` checks where needed).

New RPCs (SECURITY DEFINER, search_path=public):
- `rpc_mark_order_confirmed(p_order_id uuid)` — admin OR seller-of-order; sets `communication_status='whatsapp_confirmed'`, logs `order_events`. Triggers Shopify tag flip via edge function call (best-effort; the edge function does the actual API call).
- `rpc_mark_no_response(p_order_id uuid)` — admin/seller; sets `communication_status='no_response'`.
- `rpc_cancel_order(p_order_id uuid, p_reason text)` — admin only; sets `order_status='CANCELLED'`, logs event.

### 2. Refactor edge function: `create-draft-order` → unified
Rename intent: handle BOTH customer checkout AND seller dashboard.

New request fields:
- `orderSource: 'customer_checkout' | 'seller_dashboard'` (required)
- `createdBySellerId?: string` (uuid; required when `seller_dashboard`)
- `sellerName?: string` (for tagging)
- `existingOrderId?: string` (for retry — skip insert, only sync to Shopify)

Behavior changes:
- Insert order with `order_source`, `created_by_seller_id`, `communication_status='pending_whatsapp'`, `shopify_sync_status='not_synced'`.
- Build Shopify tags array per spec:
  - Common: `Website Order`, `Luut SLU`, `Pending WhatsApp Confirmation`, `Pickup`, `pickup-{location}`.
  - Customer: add `Customer Checkout`.
  - Seller: add `Seller Created Order`, `Seller: {sellerName}`.
- Build Shopify note per spec (different intro + fields per source).
- After Shopify create succeeds: `update orders set shopify_draft_order_id, shopify_draft_order_name, shopify_draft_order_invoice_url, shopify_sync_status='draft_created', shopify_synced_at=now()`.
- On failure: `shopify_sync_status='draft_failed'`, `shopify_sync_error=<msg>`. Still return success (order saved).
- Idempotency: if order already has `shopify_draft_order_id`, do PUT update instead of POST create; mark `draft_updated`.

### 3. New edge function: `po-… ` style — `update-draft-order-tags`
Single-purpose helper used by:
- "Mark WhatsApp Confirmed" → remove `Pending WhatsApp Confirmation`, add `WhatsApp Confirmed`.
- "Mark No Response" → add `No Response`.
- Used internally by `rpc_mark_order_confirmed` callers (UI calls function after RPC).

### 4. New edge function: `complete-draft-order` (admin only)
- Verifies admin via JWT + `has_role`.
- Calls Shopify `PUT /draft_orders/{id}/complete.json` (mark as paid optional flag).
- On success: copy `shopify_order_id` / `shopify_order_name` from response onto `orders`, set `shopify_sync_status='completed'`, `order_status='COMPLETED'`.

(`po-publish-to-shopify` is unrelated — for POs, leave alone.)

### 5. Frontend — customer flow (`Checkout.tsx`)
- Pass `orderSource: 'customer_checkout'` in invoke body.
- Persist `shopifyDraftOrderId` + invoice URL into the `luut-order-confirmed` localStorage payload (already partial). No popup change — `OrderConfirmed` + `WhatsAppConfirmPopup` already match the spec wording.
- Already handles POS skip via `isPos`.

### 6. Frontend — seller flow (`CreateOrderDialog.tsx`)
- Replace direct `supabase.from("orders").insert(...)` with `supabase.functions.invoke('create-draft-order', { body: { ...form, orderSource: 'seller_dashboard', createdBySellerId: sellerId, sellerName } })`.
- After success, show a small post-create card with:
  - Order number, totals.
  - "Message Customer on WhatsApp" button — prefilled per spec.
  - Status pill: Pending WhatsApp Confirmation.
  - Buttons: Mark WhatsApp Opened, Mark Confirmed, Mark No Response.
- Remove the manual `seller_products.quantity` decrement (spec: don't double-decrement). Keep `product_sales` recording out of this path — Shopify completion is the source of truth. (Confirm with user if they want a soft reservation flag instead.)

### 7. Admin dashboard (`AdminOrders.tsx` / `AdminOrdersPage.tsx`)
Add per-row action menu showing draft + sync info and buttons:
- Open Shopify Draft (links to `https://{shop}.myshopify.com/admin/draft_orders/{id}`)
- Resync Draft Order → invokes `create-draft-order` with `existingOrderId`.
- Mark WhatsApp Confirmed → `rpc_mark_order_confirmed` + `update-draft-order-tags`.
- Mark No Response → `rpc_mark_no_response`.
- Cancel Order → `rpc_cancel_order`.
- Complete Shopify Draft Order → `complete-draft-order` (admin only).
Row badges: `order_source`, `shopify_sync_status`, `communication_status`, seller chip if seller-created.

### 8. Seller dashboard (`SellerOrders.tsx` / `SellerOrderDetail.tsx`)
Per-row buttons (only own/own-product orders, RLS already enforces):
- Message Customer (WhatsApp prefilled).
- Mark WhatsApp Opened / Confirmed / No Response.
- Request Admin Completion → inserts an `order_events` row with type `completion_requested`; admin sees in queue.
No "Complete draft" button for sellers.

### 9. Multi-seller orders
- Already split via `order_items.seller_id` — no change. Sellers see only their items via existing RLS; admins see full order.

### 10. Inventory
- Confirm: do NOT decrement `seller_products.quantity` on draft creation. Shopify handles real inventory at completion. Document this in `mem://feature/order-flow-inventory`.

### Technical details

- Edge functions involved: `create-draft-order` (refactor), new `update-draft-order-tags`, new `complete-draft-order`. All deploy under existing `verify_jwt = false` and validate caller role in code.
- Shopify Admin API: `2025-01` (already in use). Endpoints: `POST /draft_orders.json`, `PUT /draft_orders/{id}.json`, `PUT /draft_orders/{id}/complete.json`.
- Existing `SHOPIFY_ADMIN_TOKEN` secret is sufficient.
- All new RPCs follow the project pattern (SECURITY DEFINER, `has_role` / `is_seller_for_order` gates).

### Out of scope (will not be built unless asked)
- Stock reservation system (mentioned in spec as optional / future).
- Shopify webhook ingestion of completion back into website (orders already have a sync function `sync-shopify-orders` that can be used later).
- Editing existing draft orders' line items from admin UI (only resync of current website state).
