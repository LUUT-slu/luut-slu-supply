## Add Existing Products to Purchase Orders

Extend the PO system so users can pull in already-listed products (Shopify or local seller products) as a restock snapshot, edit a batch-specific copy of price/variants/qty, and later choose how (or whether) to push back to Shopify on arrival.

### 1. Data Model Changes (migration)

Extend `purchase_order_items` to support multi-variant restock snapshots:

- `source_type` enum: `manual` | `shopify` | `seller_product` (default `manual`)
- `source_product_ref` text (Shopify product ID OR seller_products.id)
- `current_shopify_price` numeric (snapshot of live price at add-time, for display "Current vs New")
- `current_shopify_stock` int (snapshot of live stock at add-time)
- `compare_at_price` numeric
- `is_restock` boolean default false

New table `purchase_order_item_variants`:
- `id`, `item_id` (fk → purchase_order_items, on delete cascade)
- `included` boolean default true (toggle in/out of this PO)
- `shopify_variant_id` text nullable
- `option_color`, `option_size`, `option_other` text
- `cost_per_item`, `selling_price`, `compare_at_price` numeric
- `quantity_ordered`, `quantity_arrived`, `quantity_missing`, `quantity_damaged` int
- `is_new_variant` boolean (variant added inside PO, not in Shopify yet)
- generated `expected_profit`, `profit_margin`
- RLS: piggyback on parent item ownership via `is_po_owner` lookup

Trigger `recalc_po_totals` updated to roll up variants when present (sum across variants for items with `source_type != 'manual'`).

### 2. RPCs

- `rpc_po_add_existing_product(p_po_id, p_source_type, p_source_ref, p_snapshot jsonb)` — creates an item + child variant rows from a snapshot built client-side (fewer round trips, no SQL string-building).
- `rpc_po_confirm_arrival` extended: accepts per-variant arrivals when item has variants.

### 3. Edge Function: `po-publish-to-shopify` (extend, do not break existing)

New body shape:
```
{ item_id, sync_mode: "inventory_only" | "inventory_price" | "inventory_variants" | "create_new" | "po_only", confirm_price_change: boolean }
```

Behavior:
- `po_only` → mark synced=skipped, no Shopify call.
- `inventory_only` → for each included variant with shopify_variant_id, call Inventory Levels API to add `quantity_arrived` to current on-hand at the store's primary location. Do NOT touch price/options.
- `inventory_price` → above, plus update variant `price` (and `compare_at_price`) only when `confirm_price_change=true`.
- `inventory_variants` → above, plus PUT variant option1/option2 values; create new variants for `is_new_variant=true` rows via POST `/products/{id}/variants.json`.
- `create_new` → existing create-product flow (today's behavior) with a fresh Shopify product.
- Seller role guard: sellers may only call `inventory_only` and `po_only`. Anything that mutates Shopify price/variants → 403 unless admin.

Always write the existing `luut_purchase` private metafields snapshot.

### 4. Frontend

**New components**
- `ExistingProductPickerDialog.tsx` — search across Shopify (Storefront API via existing `lib/shopify.ts`) + `seller_products` (Supabase) in a single tabbed/typeahead modal. Filters: name, category, subcategory, source (Shopify/Website), seller (admin only), tags. Returns a unified `PickedProduct` shape with variants.
- `RestockEditDialog.tsx` — opens after a product is picked. Shows:
  - Header: existing name, current Shopify price, current stock (if known), restock badge.
  - Editable batch fields: cost, selling price, compare-at, qty, expected arrival, supplier, image, category/sub, tags, notes.
  - Variants table: include checkbox, color, size, cost, selling price, qty ordered. Buttons: "Add variant", "Remove from PO".
  - Save → calls `rpc_po_add_existing_product`.
- `RestockSyncDialog.tsx` — replaces/wraps `PublishShopifyDialog` when `source_type != 'manual'`. Radio group for the 5 sync modes + "Update Shopify price?" confirmation when batch selling price differs from `current_shopify_price`.

**PO detail page (`PurchaseOrderDetail.tsx`)**
- Add second button next to "Add Item": **"Add Existing Product"** → opens `ExistingProductPickerDialog`.
- For items with `source_type != 'manual'`, item row renders an expanded card with: current vs new price, current vs incoming stock, expected stock after arrival, variants table, expected batch profit. Replaces the existing single-row layout for those items only.
- Confirm Arrival dialog: when item has variants, show per-variant arrived/missing/damaged fields.
- Sync button uses `RestockSyncDialog` for restock items.

**Hook updates (`usePurchaseOrders.ts`)**
- Add `POItemVariant` type and include variants in `usePurchaseOrder` query.
- `useAddExistingProduct()` mutation wrapping the new RPC.
- Update `useUpsertItem` to leave `source_type='manual'` items untouched.

### 5. Seller / Permission Rules

- Picker filters seller_products to `seller.user_id = auth.uid()` for non-admin owners.
- Shopify products freely browsable but the sync edge function enforces role gates (above).
- UI hides "Update Shopify price/variants" radios for non-admin owners and shows: "Admin approval required for Shopify changes."

### 6. Out of Scope / Non-changes

- Existing manual-item flow, totals/tags RPCs, reports page, dashboard cards, customer-facing flows untouched.
- No new secrets needed (`SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_STORE_DOMAIN` already configured).
- No changes to checkout, orders, or PO list page beyond new buttons.

### Files

**New**
- `supabase/migrations/<ts>_po_existing_products.sql`
- `src/components/purchase-orders/ExistingProductPickerDialog.tsx`
- `src/components/purchase-orders/RestockEditDialog.tsx`
- `src/components/purchase-orders/RestockSyncDialog.tsx`

**Edited**
- `supabase/functions/po-publish-to-shopify/index.ts`
- `src/hooks/usePurchaseOrders.ts`
- `src/pages/purchase-orders/PurchaseOrderDetail.tsx`
- `src/integrations/supabase/types.ts` (auto)

Approve to proceed; I'll run the migration first, then code.
