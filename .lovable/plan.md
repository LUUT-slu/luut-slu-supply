

# Admin Analytics Dashboard

## Current State
- `seller_products` has `views_count` and `clicks_count` columns but all values are 0 — no tracking code exists
- No analytics events table exists in the database
- No client-side event tracking is implemented anywhere
- The admin hub at `/admin` has basic stats (orders, sellers, partners) but no product analytics
- The project uses Recharts (via `chart.tsx` UI component) for charting

## What We'll Build

### Phase 1: Event Tracking Infrastructure

**New database table: `analytics_events`**
Captures granular user actions with columns: `id`, `event_type`, `product_id`, `product_name`, `product_category`, `seller_id`, `session_id`, `user_id` (nullable), `metadata` (jsonb), `created_at`.

Event types tracked:
- `product_viewed` — product detail page opened
- `product_clicked` — product card clicked from any listing
- `image_interacted` — gallery swiped/clicked
- `variant_selected` — variant option changed
- `add_to_cart` — item added to cart
- `checkout_started` — checkout page opened
- `order_completed` — order placed

**New hook: `useAnalyticsTracker`** — provides a `trackEvent()` function that fires-and-forgets inserts into `analytics_events`. Generates a session ID (stored in sessionStorage) for unique visitor tracking.

**Instrumentation points:**
- `ProductDetail.tsx` and `LocalProductDetail.tsx` — track `product_viewed`, `image_interacted`, `variant_selected`
- `ProductCard.tsx` / `UnifiedProductCard.tsx` — track `product_clicked` on card click
- `cartStore.ts` `addItem` — track `add_to_cart`
- `Checkout.tsx` — track `checkout_started` on mount
- `create-draft-order` edge function or order confirmation — track `order_completed`

Also: a cron-like approach to aggregate `views_count` / `clicks_count` on `seller_products` is not needed — the dashboard will query `analytics_events` directly with date filters.

### Phase 2: Analytics Dashboard Page

**New route:** `/admin/analytics` — lazy-loaded, admin-only.

**New page:** `src/pages/admin/AdminAnalytics.tsx`

Layout (responsive, mobile-first):

1. **Filter bar** — Date range (Today / 7d / 30d / Custom), Category dropdown, Seller dropdown, Stock filter. Uses existing Shadcn components (Select, Popover + Calendar for custom range).

2. **Summary cards row** — Total Visitors (unique sessions), Total Views, Total Clicks, Total Add-to-Carts, Total Orders, Avg Conversion Rate. Each card shows value + % change vs previous period.

3. **Charts section** (2-column grid on desktop, stacked on mobile):
   - Views over time (area chart)
   - Add-to-cart trend (bar chart)
   - Conversion funnel (funnel/bar: views → clicks → cart → checkout → order)
   - Top products by attention (horizontal bar)

4. **Leaderboard tables** (tabbed):
   - Most Viewed
   - Most Clicked
   - Most Added to Cart
   - Best Converting (view→order rate)
   - High Views, Low Cart (attention but no conversion)

5. **Insights section** — Auto-generated text alerts:
   - "Product X gets many views but low cart adds"
   - "Product Y has strong add-to-cart rate — consider promoting"
   - "Product Z is underperforming in its category"

6. **Product detail slide-over** — Click any product row to see: image, name, category, price, stock, full funnel metrics, click trend sparkline, last interaction date.

7. **Compare mode** — Select 2-3 products via checkboxes, show side-by-side metrics table.

8. **Export** — CSV download button for current filtered data.

### Phase 3: Admin Hub Integration

Add an "Analytics" module card to `AdminHub.tsx` linking to `/admin/analytics`.

### File Changes Summary

| File | Action |
|---|---|
| Migration | Create `analytics_events` table + RLS policies |
| `src/hooks/useAnalyticsTracker.ts` | New — `trackEvent()` hook |
| `src/pages/ProductDetail.tsx` | Add view/variant/image tracking calls |
| `src/pages/LocalProductDetail.tsx` | Add view tracking calls |
| `src/components/UnifiedProductCard.tsx` | Add click tracking |
| `src/components/ProductCard.tsx` | Add click tracking |
| `src/stores/cartStore.ts` | Add add-to-cart tracking |
| `src/pages/Checkout.tsx` | Add checkout-started tracking |
| `src/pages/admin/AdminAnalytics.tsx` | New — full dashboard page |
| `src/components/admin/AnalyticsFilters.tsx` | New — filter bar component |
| `src/components/admin/AnalyticsCards.tsx` | New — summary cards |
| `src/components/admin/AnalyticsCharts.tsx` | New — charts section |
| `src/components/admin/AnalyticsLeaderboard.tsx` | New — tabbed tables |
| `src/components/admin/AnalyticsInsights.tsx` | New — auto-generated insights |
| `src/components/admin/ProductAnalyticsDetail.tsx` | New — product detail panel |
| `src/hooks/useAnalyticsData.ts` | New — queries for dashboard data |
| `src/App.tsx` | Add `/admin/analytics` route |
| `src/pages/AdminHub.tsx` | Add Analytics module card |

### Database Migration

```sql
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  product_id text,
  product_name text,
  product_category text,
  seller_id text,
  session_id text,
  user_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_type_created ON analytics_events(event_type, created_at);
CREATE INDEX idx_analytics_events_product ON analytics_events(product_id, created_at);
CREATE INDEX idx_analytics_events_session ON analytics_events(session_id);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (anonymous tracking)
CREATE POLICY "Anyone can insert analytics events"
  ON analytics_events FOR INSERT WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can read analytics events"
  ON analytics_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
```

### Technical Notes
- All tracking is fire-and-forget (no await, no error handling that blocks UX)
- Session ID generated once per browser session via `crypto.randomUUID()`, stored in `sessionStorage`
- Dashboard queries use date-filtered aggregations with `GROUP BY product_id`
- Charts use the existing Recharts setup via `chart.tsx`
- CSV export uses client-side blob generation
- No external dependencies needed — all built with existing stack

