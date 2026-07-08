## Goal
On the vendor dashboard (`SellerDashboardNew`), make the Day / Week / Month toggle above the revenue cards use calendar-anchored periods in Saint Lucia time, not rolling windows:

- **Day** — today only (SLU midnight → now)
- **Week** — current week starting Monday → now (if today is Wednesday, show Mon–Wed)
- **Month** — 1st of the current month → now (if today is the 3rd, show 1st–3rd)

No other dashboards, no other cards, and no other stats change.

## Where
- `src/hooks/useSellerStats.ts` — the period math that feeds `todayRevenue` / `todayOrders` used by the two period-scoped cards.

## Changes

1. Keep the existing SLU-offset anchor (`nowSlu`, `sluY/sluM/sluD`) but make the window explicit and end at "now", not "end of today":
   - `day`: start = SLU today 00:00
   - `week`: start = SLU Monday of this week 00:00 (Sun treated as end of previous week, so Monday is 6 days back)
   - `month`: start = SLU 1st of this month 00:00
   - end (all three) = current instant (`new Date()`)

2. Switch the period filter to use the order's **created_at** consistently for what the seller "made" in that window, instead of `effectiveOrderDate` (which swaps in `preferred_date` for Shopify rows and can push a sale into a different week/month based on pickup date). Total/all-time cards remain untouched.

3. Revenue in the period still counts only orders with `status === "completed"` (unchanged) and keeps the existing failed-sync dedupe (unchanged).

4. `todayReadyForPickup` (used by the Orders card subtitle) keeps its current "pickup today" meaning — not affected by the toggle.

5. Card labels/subtitles in `SellerDashboardNew.tsx` stay as they are ("This Week", "This Month", etc.).

## Out of scope
- Admin analytics, partner dashboard, all-time totals, best-seller logic, order lists, and the `useSellerStats` `dateRange` argument all stay as-is.
