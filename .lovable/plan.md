
# Import Shopify Products as Draft POs

Good news from the investigation: no schema changes needed. `purchase_orders.status='draft'` is already the default, `purchase_order_items.source_type='shopify'` and `source_product_ref` already exist, and there's a per-variant table (`purchase_order_item_variants`) with a `shopify_variant_id` column. Shopify env vars (`SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_STORE_DOMAIN`) are already wired.

## What gets pulled from Shopify

Single Admin GraphQL query (API `2025-07`) that paginates products and returns, per variant:

- `product.vendor` → PO `supplier_name`
- `product.title` / `variant.title` / options → item + variant rows
- `variant.inventoryItem.unitCost.amount` → `cost_per_item`
- `variant.inventoryItem.inventoryLevels`: `quantities(names:["available"])` + `location { id name }` → `quantity_ordered` per location
- `product.id`, `variant.id`, image, price → link + snapshot fields

Anything not derivable from Shopify (customs cost, supplier link, notes, date_ordered, etc.) is left blank on purpose.

## Grouping rule (one PO per group)

**One draft PO per `(vendor, location)`** — because supplier is a PO-level field and stock lives per location. Each variant of a product becomes a `purchase_order_item_variants` row grouped under one `purchase_order_items` line for its parent product. Products with no vendor go to a group with `supplier_name = "Unknown supplier"`. Variants with no stock at that location are skipped (nothing to reorder).

Naming: `Shopify import · {Vendor} · {Location} · {YYYY-MM-DD}`.
Every imported PO gets `notes = "Imported from Shopify on {date}. Draft — fill customs cost and any missing fields before finalizing."` so it's obvious in the UI.

## Draft marking

- Rely on the existing `status='draft'` — the `POStatusBadge` already renders it grey.
- Line items get `source_type='shopify'` and `shopify_sync_status='imported_draft'` so the detail page can show a small "from Shopify" chip.
- No new column, no new enum value.

## Duplicate skipping

Before inserting, for each candidate `(vendor, location)` group, query existing POs where `status='draft'` AND `supplier_name = vendor` AND at least one existing item's `shopify_product_id` overlaps with the group's product IDs. If overlap exists → **skip the whole group** and return it in the response as `skipped: [{ vendor, location, existingPoId, overlapCount }]` so the UI can show "3 groups skipped — already have a draft".

## Trigger UI (as you asked — button on Purchase Orders page)

On `/admin/purchase-orders` (list page), add a header button **"Import from Shopify"** next to the existing Reports button (admin-only; hidden when `basePath` is `/seller/...`). Clicking it opens a dialog:

1. **Preview step** — dialog calls the edge function with `{ dryRun: true }`. Shows a summary table:
   ```
   Vendor          Location    Products   Variants   Total qty   Status
   Nike            Castries    12         38         420         Will create
   Adidas          Vieux Fort  6          14         180         Will create
   Unknown         Castries    2          2          30          Will create
   Puma            Castries    8          22         —           Skipped (draft PO-1042 exists)
   ```
2. **Confirm** → same function with `{ dryRun: false }` runs the actual insert. Shows a success toast with counts + list of created PO IDs. Query cache invalidates so the list refreshes and the new drafts appear at the top.

## Edge function

New: `supabase/functions/import-shopify-po-drafts/index.ts`

- Verify caller is admin (bearer JWT → `user_roles` check) — non-admins get 403.
- Reads `SHOPIFY_ADMIN_TOKEN` and `SHOPIFY_STORE_DOMAIN` (with the existing fallback).
- Paginates `products` (250 per page) with `first: 250, after: cursor` including `variants.inventoryItem.unitCost` and `inventoryLevels`.
- Groups results in memory by `(vendor, locationId)` → skips zero-stock variants → runs the duplicate check → inserts.
- Insert path: one `purchase_orders` row per group, one `purchase_order_items` row per product, one `purchase_order_item_variants` row per variant. Uses the service-role client (bypasses RLS but records `owner_user_id = caller.id`, `owner_role='admin'`).
- Response: `{ created: [...poIds], skipped: [...], preview: {...} }`.

## Existing-product linking

For each imported line, look up `seller_products.shopify_product_id` (already `UNIQUE`) and set `linked_seller_product_id` when it matches. If no match, leave null — user can link later.

## Assumptions to confirm

1. **Grouping = one PO per (vendor, location)** — say the word if you'd prefer per-vendor only (rolling up all locations) or a single giant PO.
2. **Zero-stock variants skipped**. If you actually want them included so you can plan a full restock, we include everything and let you set qty manually.
3. **Duplicate rule = skip whole vendor+location group when ANY overlap exists with an existing draft**. Alternative: item-level dedup (skip only the overlapping products, still create a PO for the rest).
4. **Vendor missing → "Unknown supplier" group**. Alternative: skip those entirely.
5. Import button lives only on the **admin** Purchase Orders page, not seller portal.

If you're good with those, I'll build it: edge function + dialog + list-page button + preview/confirm flow. No DB migration needed.
