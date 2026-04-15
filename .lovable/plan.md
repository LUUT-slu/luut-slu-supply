

# Add "Analysis" Module to Admin Control Panel + Total Revenue

## What Already Exists
- Analytics dashboard page at `/admin/analytics` with full charts, leaderboards, insights, filters, CSV export
- An "Analytics Dashboard" card already exists in AdminHub (line 164-172)
- The `orders` table has `total_price` and `order_status` columns for revenue calculation

## Changes

### 1. Rename the AdminHub card from "Analytics Dashboard" to "Analysis"
- Update title to "Analysis"
- Update description to "View traffic, sales, and store performance"
- Keep the same route `/admin/analytics`

### 2. Add Total Revenue to the Analytics Dashboard
- In `AdminAnalytics.tsx`: query `orders` table for completed orders within the date range, sum `total_price` as total revenue
- Pass `totalRevenue` to `AnalyticsCards`
- In `AnalyticsCards.tsx`: add a 7th card "Total Revenue" with a `CreditCard` icon showing formatted EC$ amount

### 3. Update page title
- Change "Analytics Dashboard" heading to "Analysis" in `AdminAnalytics.tsx`

### Files Modified
| File | Change |
|---|---|
| `src/pages/AdminHub.tsx` | Rename card title/description |
| `src/pages/admin/AdminAnalytics.tsx` | Add revenue query, pass to cards, update heading |
| `src/components/admin/AnalyticsCards.tsx` | Add Total Revenue card |
| `src/hooks/useAnalyticsData.ts` | No changes needed — revenue comes from orders table directly |

### Revenue Query Logic
```sql
SELECT COALESCE(SUM(total_price), 0) as total_revenue
FROM orders
WHERE order_status = 'COMPLETED'
  AND created_at >= :startDate
  AND created_at <= :endDate
```

This will be a separate `useQuery` call in the analytics page, filtered by the same date range as the analytics filters.

No database migrations needed.

