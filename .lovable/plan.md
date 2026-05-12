## Goal
Make Shopify full resync create or update fetched orders instead of skipping them, and expose exact skip reasons when a record truly cannot be saved.

## What I found
- The Shopify sync function is fetching orders successfully.
- The current failure is a database write issue, not a business-rule filter on completed/POS/paid orders.
- Recent backend logs show every skipped order failing on the same error:
  - `there is no unique or exclusion constraint matching the ON CONFLICT specification`
- The function currently uses `upsert(... onConflict: "shopify_order_id")`.
- The database has a partial unique index on `orders.shopify_order_id`, but PostgREST upsert conflict inference is not matching it reliably here, so every write is treated as a skip.
- Admin Orders already loads from `orders` without filtering out completed or Shopify sources; the main reason nothing shows is that the sync is not saving any Shopify orders.

## Plan

### 1) Fix backend import logic so fetched Shopify orders save
Update `sync-shopify-orders` to stop depending on the failing `onConflict: "shopify_order_id"` path.
- Read by `shopify_order_id` first.
- If a matching order exists, update it by row `id`.
- If no match exists, insert a new row.
- Keep `shopify_order_id` as the only Shopify dedupe key.
- Do not skip because an order is completed, paid, fulfilled, POS, archived, closed, unassigned, or missing a website customer.
- Preserve fallback values like `Shopify customer` / `Walk-in Customer`, blank phone, and null partner assignment.

### 2) Improve skip diagnostics in sync results
Expand the sync function response and saved sync state so real failures are explicit.
- Record a structured per-order skip/error item with:
  - Shopify order ID
  - Shopify order number
  - source
  - financial status
  - fulfillment status
  - created date
  - exact reason
- Distinguish update/create success from real database failures.
- Treat duplicate-existing orders as updates, not skips.
- Save a readable summary in `shopify_sync_state` and return the detailed list to the UI.

### 3) Add a dedicated admin sync log panel
Extend the Admin Orders page with a panel showing:
- fetched
- created
- updated
- skipped
- detailed per-skip reason rows
This will make it obvious whether a full resync produced creates, updates, or true failures.

### 4) Verify All Orders behavior for imported Shopify data
Confirm the Admin Orders page continues to include:
- website orders
- Shopify POS
- Shopify Online
- manual orders
- completed and archived/closed imported Shopify orders
If any display-only condition blocks Shopify rows after backend save succeeds, remove that condition.

## Technical notes
- Primary source files:
  - `supabase/functions/sync-shopify-orders/index.ts`
  - `src/hooks/useShopifySyncStatus.ts`
  - `src/pages/AdminOrdersPage.tsx`
- Likely no schema change is required for the main fix because the table already has `shopify_order_id` and supporting fields.
- If the existing partial unique index still needs hardening for long-term safety, I’ll add a follow-up migration only if it is necessary after the function fix.

## Expected result
After Full Resync, `Fetched 142` should become a mix of `Created` and `Updated`, with `Skipped` only for genuine invalid-record or database errors, and any skipped rows should show exact reasons in the admin UI.