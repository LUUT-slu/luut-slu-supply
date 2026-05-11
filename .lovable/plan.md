# Shopify Order Sync (Online Store + POS)

Pull Shopify orders into Lovable Cloud so POS sales appear in the admin dashboard alongside website orders, with no double entry.

## 1. Database changes

Extend the existing `orders` table (preserves order numbering, assignments, ledger, RLS):

- `source` text (default `'website'`) — one of: `website`, `shopify_online`, `shopify_pos`, `manual`
- `shopify_order_id` text, **UNIQUE** — Shopify GraphQL ID
- `shopify_order_name` text — e.g. `#1042`
- `shopify_channel` text — raw Shopify source/channel name
- `shopify_pos_location_id` text, `shopify_pos_location_name` text
- `shopify_financial_status` text (paid, pending, refunded…)
- `shopify_fulfillment_status` text (fulfilled, partial, unfulfilled)
- `shopify_total_discounts` numeric
- `shopify_synced_at` timestamptz
- Index on `(source)` and `(shopify_order_id)`

New table `shopify_sync_state`:
- `id` text PK (singleton `'orders'`)
- `last_synced_at` timestamptz
- `last_cursor` text (Shopify `updated_at` watermark)
- `last_status` text, `last_error` text, `last_run_count` int

RLS: admin-only read/write on `shopify_sync_state`.

## 2. Edge function: `sync-shopify-orders`

Secure backend (uses existing `SHOPIFY_ADMIN_TOKEN`). `verify_jwt = false` with manual admin check via `has_role`.

Flow per run:
1. Read `shopify_sync_state.last_synced_at` (default = now − 7 days on first run).
2. GraphQL Admin API `orders(query: "updated_at:>=<watermark>", first: 50, sortKey: UPDATED_AT)` with pagination cursor. Fields: id, name, createdAt, updatedAt, displayFinancialStatus, displayFulfillmentStatus, totalPriceSet, totalDiscountsSet, currencyCode, sourceName, channelInformation { channelDefinition { handle } }, customer { id email phone firstName lastName }, shippingAddress, lineItems(first:50) { title quantity originalUnitPriceSet variant { id sku product { id } } }, retailLocation { id name } (POS only).
3. For each order:
   - `source` = `shopify_pos` if `sourceName == 'pos'` or retailLocation present, else `shopify_online`.
   - `UPSERT` on `shopify_order_id`. Map line items to `order_items` (also upsert by `(order_id, shopify_line_id)` — add this column too).
   - If customer email/phone present: find or create `customer_profiles` (re-use `handle_new_customer` logic; no auth user → null `user_id`, store email/phone/full_name + `auth_provider='shopify_pos'`). Link via `orders.customer_user_id` only when matching auth user exists.
   - Insert `order_events` row `{ event_type: 'shopify_synced', payload: { source, financial_status, ... } }`.
4. Update `shopify_sync_state` watermark to max `updatedAt` seen + status.
5. On API failure: write `last_status='error'`, `last_error`, send `send-admin-alert`, return 502.

Inventory: do **not** mutate `partner_stock` from POS — Shopify is source of truth. Add a `shopify_inventory_snapshot` field on `order_items` (qty after sale) for analytics; live levels stay queried via Shopify when needed.

## 3. Scheduled sync

Use `pg_cron` + `pg_net` (per `schedule-jobs-supabase-edge-functions`):
```sql
select cron.schedule(
  'shopify-orders-sync', '*/5 * * * *',
  $$ select net.http_post(
       url:='https://<ref>.supabase.co/functions/v1/sync-shopify-orders',
       headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body:='{"trigger":"cron"}'::jsonb) $$);
```
Inserted via `supabase--insert` (not migration) since URL/anon are project-specific.

## 4. Admin UI

`src/pages/AdminOrdersPage.tsx`:
- Add **"Sync Shopify Orders"** button (top right): calls `supabase.functions.invoke('sync-shopify-orders')`, shows toast with count + last sync time. Disable while running.
- Replace/extend the existing tabs filter with: **All · Website · Shopify Online · Shopify POS · Manual**, driven by `orders.source`.
- Order row badge: show `Shopify POS`, `Shopify Online`, `Manual`, or none — colored variants. Show Shopify order name (`#1042`) and POS location when applicable.
- Order detail sheet: show financial/fulfillment status, channel, location, "View in Shopify Admin" link.
- Surface `shopify_sync_state.last_status='error'` as a red banner: *"Shopify order sync failed. Check API permissions or connection."* with retry button.

New hook `useShopifySyncStatus()` polls `shopify_sync_state` every 30s for the banner + last-synced timestamp.

## 5. Customer linking

In sync function, for each Shopify customer:
- Match by `email` (case-insensitive) → existing `customer_profiles.email`.
- Else by normalized `phone`.
- Else insert a new `customer_profiles` row (no `user_id`); future social login will merge via existing `handle_new_customer` (extend it to claim orphan profile by email).

## 6. Security

- Admin token stays in edge function env (`SHOPIFY_ADMIN_TOKEN`, already set).
- Function validates caller: cron path uses service-role check; UI path requires `has_role(admin)`.
- No Shopify Admin call ever runs from the browser.

## 7. Future-ready hooks

The `source`, `shopify_pos_location_*`, financial status, and per-item Shopify IDs unlock without further migrations:
- Sales analytics by channel/location
- Best sellers including POS
- Customer purchase history (joined via `customer_profiles`)
- Loyalty discounts (existing `customer_discounts`)
- WhatsApp follow-ups (existing seller WhatsApp routing)

## Files

**New**
- `supabase/functions/sync-shopify-orders/index.ts`
- `src/hooks/useShopifySyncStatus.ts`
- `supabase/migrations/<ts>_shopify_order_sync.sql`

**Edited**
- `src/pages/AdminOrdersPage.tsx` — sync button, source tabs, badges, error banner
- `src/components/admin/AssignOrderModal.tsx` (only if needed for Shopify metadata display)
- `supabase/config.toml` — register `sync-shopify-orders` (no JWT)

## Open questions

1. **Backfill window** — first run pulls last 7 days. Do you want a longer initial backfill (30/90 days / all time)?
2. **POS-synced order assignment** — POS sales are already completed by you in person. Should they auto-mark as `COMPLETED` (skipping NEW → ASSIGNED), or land as `NEW` for manual review?
3. **Inventory** — confirm we keep Shopify as sole source of truth (no writes back to `partner_stock`) for POS orders.
