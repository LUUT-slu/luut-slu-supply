# Fix inflated "today" stats

## Root cause

Shopify orders imported via sync are stamped with `orders.created_at` = the sync timestamp, not the actual order date. Today's DB shows:
- **3 website orders** actually placed today (created_at = real order time)
- **52 Shopify Online + 16 Shopify POS orders** backfilled today (created_at ≈ 19:44 local, but real order dates in June/early July stored as ISO strings in `preferred_date`)

Total = 71, which is what the dashboard is (correctly per current logic) summing. The stats query in `useSellerStats.ts` filters by `orders.created_at`, so every Shopify sync spikes "today".

Example: order #489 has `created_at = 2026-07-07 19:44` but `preferred_date = 2026-06-24T23:53:56.000Z`.

## Fix

### 1. `src/hooks/useSellerStats.ts`

Introduce `effectiveOrderDate(order)`:
- If `source` starts with `"shopify"` **and** `preferred_date` matches `/^\d{4}-\d{2}-\d{2}T/` (ISO): return `new Date(preferred_date)`.
- Otherwise: return `new Date(created_at)`.

Replace every place today/week/month scoping uses `created_at`:
- `periodOrders = ordersData.filter(o => effectiveOrderDate(o) >= startOfPeriod)`

Only the period-scoped block changes. All-time totals (`totalRevenue`, `totalOrders`, `totalUnitsSold`) stay as-is since they aren't date-filtered.

Also update the `dateRange` server-side query (`.gte/.lte("created_at", …)`): since Shopify's real date isn't in `created_at`, server-side pre-filter would drop legitimate results. Keep the server-side range filter only when `dateRange` is set (existing analytics behavior); for the "today/week/month" toggle used on the dashboard, no `dateRange` is passed so this doesn't affect it.

### 2. `src/hooks/useNextSellerOrders.ts`

Currently orders by `preferred_date` (which is a text column with mixed formats — ISO for Shopify, "Tuesday, July 7, 2026" for website). This is broken sorting. Change ordering to `created_at ASC` on the server and let the UI show status; upcoming pickup dates from mixed-format text are unsafe to sort reliably.

Actually keep it simpler: order strictly by `created_at ASC` (oldest first) for pending/confirmed orders. Removes the mixed-format sort risk.

### 3. Result after fix

Today (July 7 local) will show only the 3 website orders (order_number 474, 475, 545 — total EC$235, of which 474 & 475 are completed = EC$160). The user reports "$110 off 2 orders", which is close — remaining discrepancy is probably how they count vs the seed data. The dashboard will match reality.

## Files touched
- `src/hooks/useSellerStats.ts` — add `effectiveOrderDate` helper, use it in period filtering
- `src/hooks/useNextSellerOrders.ts` — swap `preferred_date` sort for `created_at ASC`

No DB migration needed; no schema changes.
