

The user wants to expand Marketing Studio from "single product promo" → "multi-purpose content engine" with poster types, dynamic product sources, and reusable layouts. Need to keep current single-product flow intact and extend modularly.

Let me check what data sources already exist:
- Best sellers: `useBestSellers` hook + `weekly_best_sellers` view ✅
- New arrivals: products sorted by created_at ✅
- Low stock: `seller_products.quantity` ✅ + Shopify variant inventory
- Promotions: `discount_codes` via `manage-discounts` edge function ✅
- Restocked: `partner_stock_movements` (movement_type='stock_added') ✅
- Featured: existing `FeaturedProductPicker` ✅

Templates already support `variantImages` grid (2/3/4 tiles) — I can repurpose this for multi-product layouts.

Scope strategy: Phase 1 (this build) = top 5 poster types + multi-product layout engine. Phase 2 hooks left in place.

## Marketing Studio → Content Engine

Extend the current Studio with a **Poster Type** selector that drives a **Product Source** picker, then renders through a unified **Multi-Product Template** layer. Single-product promo flow stays exactly as today.

### Architecture

```text
[Poster Type] → [Product Source] → [Products[]] → [Layout Picker] → [Template] → [Preview + Export]
     │                  │                              │
     │                  │                              ├─ 1 item  → Spotlight (current)
     │                  │                              ├─ 2 items → Side-by-side
     │                  │                              ├─ 3 items → Hero + 2
     │                  │                              └─ 4+      → 2x2 grid (+N badge)
     │                  │
     │                  ├─ Manual pick (current product picker)
     │                  ├─ Best sellers (useBestSellers)
     │                  ├─ New arrivals (date sort)
     │                  ├─ Low stock (qty threshold)
     │                  ├─ Restocked (partner_stock_movements)
     │                  └─ Active discounts (manage-discounts)
     │
     ├─ Single Product Promo  (current — unchanged)
     ├─ Best Sellers
     ├─ New Arrivals
     ├─ Restocked
     ├─ Almost Gone / Low Stock
     └─ Active Promotions / Discounts
```

### Phase 1 — Build now

**1. New `PosterTypeSelector` component** (`src/components/marketing/PosterTypeSelector.tsx`)
- Horizontal scrollable chip row at top of Studio
- 6 chips: Single Promo · Best Sellers · New Arrivals · Restocked · Almost Gone · Promotions
- Each chip has icon + label + short hint ("Top sellers this week")
- Mobile-friendly tap targets

**2. New `ProductSourceCard` component** (`src/components/marketing/ProductSourceCard.tsx`)
- Replaces the product picker when poster type ≠ "Single Promo"
- Auto-loads products based on type using new `useMarketingProducts(posterType, options)` hook
- Shows live list with checkboxes — user can refine the auto-selection
- Optional "Limit" slider (1–6 products)
- Type-specific badge auto-applied (NEW · BEST SELLER · ALMOST GONE · RESTOCKED · SALE)

**3. New hook `useMarketingProducts`** (`src/hooks/useMarketingProducts.ts`)
- `bestsellers` → reuses `useBestSellers`
- `new-arrivals` → Shopify + local sorted by `created_at` desc
- `low-stock` → `seller_products` where `quantity > 0 AND quantity <= 5` + Shopify variants with low inventory
- `restocked` → `partner_stock_movements` where `movement_type='stock_added'` in last 14 days, joined to product
- `promotions` → calls `manage-discounts` edge function for active codes + maps to discounted products via `applies_to`
- All return same shape: `{ id, title, image, price, badge?, urgencyHint? }[]`

**4. Multi-product templates** (extend `src/components/marketing/templates.tsx`)
- New `MultiProductTemplate` component (sibling of `MarketingTemplate`)
- Reuses existing `VariantGrid` logic for 1/2/3/4+ tiles — generalized to accept arbitrary products with name + price + badge per tile
- Supports all 4 formats (Story · Post · Ad · Portrait) and 3 styles (Clean · Hype · Minimal)
- Headline auto-builds from poster type:
  - Best Sellers → "TOP PICKS THIS WEEK"
  - New Arrivals → "JUST DROPPED"
  - Restocked → "BACK IN STOCK"
  - Almost Gone → "ALMOST GONE"
  - Promotions → "ON SALE NOW" (+ shows discount %)
- All editable via existing controls (Brand, CTA, Tagline, Urgency, Meetup) — defaults adapt to poster type

**5. Toggle controls** (extend MarketingStudio controls panel)
- Add to existing branding card:
  - "Show stock badge" (already exists)
  - "Show type label" (NEW · SALE · RESTOCKED chip per tile)
  - "Show per-tile prices"
- Hide variant controls when poster type ≠ "Single Promo"

**6. Wire into `MarketingStudio.tsx`**
- New state: `posterType: PosterType`
- When `posterType === 'single'` → render existing flow exactly as today (no regression)
- Otherwise → render `ProductSourceCard` instead of single product picker, render `MultiProductTemplate` in preview + export node
- Same `usePreviewScale` + export pipeline (no changes to download mechanics)

### Files

**New (4)**
- `src/components/marketing/PosterTypeSelector.tsx`
- `src/components/marketing/ProductSourceCard.tsx`
- `src/components/marketing/MultiProductTemplate.tsx` (or extend `templates.tsx`)
- `src/hooks/useMarketingProducts.ts`

**Edited (1)**
- `src/pages/admin/MarketingStudio.tsx` — type selector at top, conditional source/picker, conditional template

### Phase 2 — Stubs only (not built yet)

Leave clear extension points but don't implement:
- Top Picks, Most Ordered (variants of best sellers)
- Bundle Offers, Limited Drops (need new admin config)
- Featured / Editor's / Staff Picks (need admin "pick list" table)
- Brand posters: Shop by Category, Why Shop With Us, How to Order (template-only, no product data)
- Auto-generated weekly posters (cron + storage)
- Seller-specific promo posters

### Out of scope
- New database tables (everything uses existing data)
- Auto-generation / cron jobs
- AI image generation (explicitly excluded)
- Posting directly to social platforms
- Carousel / multi-PNG export

### Result
- Pick "Best Sellers" → top 4 weekly best sellers auto-populate → 2x2 grid Story renders → tap download
- Pick "Almost Gone" → low-stock products auto-fill with red "ALMOST GONE" badges
- Pick "Promotions" → discounted items render with sale price strike-through
- All 4 formats × 3 styles work for every poster type
- Single Promo flow unchanged — zero regression risk

