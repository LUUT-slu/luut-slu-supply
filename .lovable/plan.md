## Problem
Switching the period filter to `created_at` broke totals: Shopify-synced orders carry `created_at = sync time`, so a recent bulk sync dumps hundreds of historical orders into "today/this week/this month". That's why Day jumped from ~$0 to $4,564.75 and Month from $1,855 to $5,264.75.

## Fix
Revert the period filter in `src/hooks/useSellerStats.ts` back to `effectiveOrderDate(o)` — which uses `preferred_date` for Shopify rows and `created_at` for native rows — so the window reflects real sale/pickup date.

Keep the other change: the period end is `new Date()` (now), and the calendar-anchored starts (today 00:00 SLU / Monday 00:00 SLU / 1st of month 00:00 SLU) stay exactly as they are.

That gives the user what they asked for originally:
- Day = today (SLU midnight → now)
- Week = Monday of this week → now
- Month = 1st of this month → now

…while restoring the correct historical numbers.

## Scope
- One file: `src/hooks/useSellerStats.ts`
- Change one line: `const d = new Date(o.created_at)` → `const d = effectiveOrderDate(o)`
- Nothing else touched.
