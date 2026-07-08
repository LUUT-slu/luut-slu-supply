# Dashboard Restructure Plan

Only the body of `src/pages/seller/SellerDashboardNew.tsx` changes. Top nav, header (logo, ID, Approved badge), and bottom quick-access grid remain untouched.

## Data audit (current state)

The existing dashboard uses `useSellerStats(profile.id, dateRange)` which queries Supabase live:
- `order_items` filtered by `seller_id` → joined to `orders` → filters revenue to `status='completed'`.
- `seller_products` count for active products.
- All values (Total Revenue, Orders, Units Sold, Active Products, Best Seller) are **live**. Nothing is hardcoded.

The dashboard does NOT currently fetch "next orders to complete" or any today-scoped metrics — those need to be added.

## Changes

### 1. Extend `src/hooks/useSellerStats.ts`
Add today-scoped aggregates without removing existing fields. New returned stats:
- `todayRevenue` — sum of `order_items.total_price` where the parent order was `created_at >= startOfToday` (local) AND `status='completed'`.
- `todayOrders` — count of distinct orders `created_at >= startOfToday`.
- `todayReadyForPickup` — of today's orders, count where `preferred_date = today` OR `status in ('confirmed','pending')` (whichever matches "ready for pickup today"; I'll use `preferred_date = today AND status != 'cancelled'`).

All queries reuse the existing `order_items → orders` join pattern — no new tables. Existing `totalRevenue`, `totalOrders`, `totalUnitsSold`, `productsActive` stay live.

### 2. New hook `src/hooks/useNextSellerOrders.ts`
Fetches next 5 pending orders for the seller:
- `order_items` where `seller_id = profile.id` → `orders` where `status IN ('pending','confirmed')` ordered by `preferred_date ASC NULLS LAST, created_at ASC`, limit 5.
- Returns `{ id, order_number, items_summary, customer_name, location, total_price, status }`.

All live from Supabase.

### 3. Rewrite body of `SellerDashboardNew.tsx`
Keep imports, `SellerNav`, header block (logo/name/ID/Approved), `SellerAIPanel`, and the bottom quick-access grid (Manage Products, View Orders, Analytics, Purchase Orders) exactly as-is.

Replace the middle section with:

**A. KPI grid (2×2 mobile, 4-col desktop)** — new order:
1. Today's Revenue (green DollarSign) — value `todayRevenue`, subtitle `{todayOrders} orders today`
2. Today's Orders (blue ShoppingBag) — value `todayOrders`, subtitle `{todayReadyForPickup} ready for pickup`
3. Total Revenue (purple TrendingUp) — value `totalRevenue`, subtitle "all-time"
4. Total Orders (gold Package) — value `totalOrders`, subtitle `{totalUnitsSold} units sold`

Remove the existing DateRangePicker from the dashboard (it only makes sense on analytics; today/all-time is fixed). Best Seller card also removed to match the reference layout.

**B. Marketing Studio card** — full-width `<Card>` with gold Sparkles icon in rounded square, title "Marketing Studio", subtitle "Generate posters & content", ChevronRight on right.
- **Route note:** the only existing Marketing Studio route is `/admin/marketing-studio` (admin-only). There is no seller-facing marketing studio route. I will wire the card to `/admin/marketing-studio` since admins operate as the primary seller (per project memory), and flag this in the summary so you can confirm or provide a different path.

**C. Next Orders to Complete section**
- Small uppercase label "NEXT ORDERS TO COMPLETE".
- Rows from `useNextSellerOrders`: colored status dot (green=Ready/confirmed, gold=En route, silver=Processing/pending), order number in gold, item summary (`Nx product · Nx product`), customer + location line, `EC$` amount, status label.
- Empty state: centered Inbox icon, "No orders logged", subtext "New orders will show up here as they come in.", and a "Create Order" button reusing existing `CreateOrderDialog`.

**D. Quick-access grid** — unchanged.

## Styling
Uses existing shadcn `Card` + Tailwind semantic tokens; no hardcoded hex values in components. The reference palette (#0A0A0B / #16161A / #26262A / #E0A82E / #A1A1AA) already matches the app's dark theme tokens, so `bg-background`, `bg-card`, `border-border`, `text-muted-foreground`, and existing `text-primary` gold accents cover it. Numbers get `tabular-nums font-mono` (or Space Grotesk if already registered — will check `tailwind.config.ts` at build time and fall back to `font-mono tabular-nums`).

## Files touched
- `src/hooks/useSellerStats.ts` — extend (no removals)
- `src/hooks/useNextSellerOrders.ts` — new
- `src/pages/seller/SellerDashboardNew.tsx` — restructure body only

Nothing else — no routing, auth, or other pages.

## Post-change summary I'll report
- Live: Today's Revenue, Today's Orders, Today's Ready for Pickup subtitle, Total Revenue, Total Orders, Units Sold subtitle, Next Orders list.
- Placeholder/assumption: Marketing Studio link points to `/admin/marketing-studio` — confirm or supply seller-facing path.
