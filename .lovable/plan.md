

The user has 3 problems:
1. **Poster types broken** — most return empty because data sources don't exist (no `weekly_best_sellers` view, no `partner_stock_movements` for restock, no real promo data)
2. **Need a Promotions Manager** — full manual campaign system feeding the Promotions poster
3. **Price format** — strip decimals everywhere in posters

Let me check what data actually exists.
<lov-tool-use id="toolu_vrtx_01ER8qKFTX8GqoQ8McS9i31f" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"SELECT COUNT(*) FROM seller_products WHERE status='active';\\\" -c \\\"SELECT COUNT(*) FROM product_sales;\\\" -c \\\"SELECT COUNT(*) FROM partner_stock_movements WHERE movement_type='stock_added';\\\" -c \\\"SELECT table_name FROM information_schema.views WHERE table_schema='public';\\\"\", \"user_facing_description\": \"Checking what marketing data sources actually exist in the database\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01SBiuh82McDULv7rBpZ2iS7" name="code--view" integration-id="code" data="{\"file_path\": \"src/hooks/useMarketingProducts.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01LzVx6igA29WdbAyuUPQVgb" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"SELECT table_name FROM information_schema.views WHERE table_schema='public';\\\" -c \\\"SELECT COUNT(*) FROM seller_products WHERE status='active';\\\" -c \\\"SELECT COUNT(*) FROM product_sales;\\\" -c \\\"SELECT COUNT(*) FROM partner_stock_movements;\\\"\", \"user_facing_description\": \"Checking marketing data sources\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_012Mxx1ygf94EYmghcWdbEbk" name="code--view" integration-id="code" data="{\"file_path\": \"src/hooks/useMarketingProducts.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EUDvV1ZHfursQBH6AWTxE6" name="code--view" integration-id="code" data="{\"file_path\": \"src/hooks/useBestSellers.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01SfqLa4B4VmfxUbj4SgqLY1" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"\\\\d+ weekly_best_sellers\\\" -c \\\"SELECT * FROM weekly_best_sellers LIMIT 3;\\\"\", \"user_facing_description\": \"Inspecting the best sellers view\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01SfoozwQ9uuPKZfp8DSPtyK" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/products.ts\", \"lines\": \"1-80\"}">
</lov-tool-use>
I have enough. Now let me check ProductSourceCard, MarketingStudio promotions wiring, and the templates price formatting briefly.
<lov-tool-use id="toolu_vrtx_01PysNPeCAmR2kH8RJgV1q3G" name="code--search_files" integration-id="code" data="{\"query\": \"price\\\\.toFixed|\\\\.toFixed\\\\(2|formatPrice|\\\\$\\\\{.*price\", \"include_patterns\": \"src/components/marketing/**,src/pages/admin/MarketingStudio.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015cGKExLfs7NBEYYja87rEW" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/marketing/ProductSourceCard.tsx\", \"lines\": \"1-60\"}">
</lov-tool-use>
I have all I need. Key findings:
- Best Sellers view is empty (no `product_sales` rows this week → 0 results)
- New Arrivals only loads local non-Shopify (`shopify_product_id IS NULL`) — too restrictive
- Restocked depends on `partner_stock_movements` (only 3 rows total, none recent)
- Promotions falls back to "any in-stock product" — works but not curated
- No Promotions Manager exists

<lov-plan>

## Fix Poster Data Loading + Add Promotions Manager

Two coordinated changes: (1) rewrite the data hook so every poster type returns usable products with proper fallbacks, and (2) add a real Promotions Manager that feeds the Promotions poster type.

### Part 1 — Fix data loading (`useMarketingProducts`)

Universal product pool: a single `fetchAllProducts()` helper merges Shopify hybrid catalog + local `seller_products` into a unified `MarketingProduct[]`. Every type derives from this pool except Best Sellers.

Per-type logic:
- **Best Sellers** — query `weekly_best_sellers`. If empty (no sales this week), fall back to **all-time** top sellers via `product_sales` aggregate. If still empty, return empty + show "No sales recorded yet" hint (this type stays accurate, no fake data).
- **New Arrivals** — universal pool sorted by `created_at` desc (or Shopify position for shopify items). No `shopify_product_id IS NULL` filter.
- **Restocked** — primary: `partner_stock_movements` last 30 days (was 14). Fallback: products with `updated_at` newer than `created_at` in last 30 days. Final fallback: newest products with badge "Back in Stock".
- **Almost Gone** — primary: `seller_products.quantity` between 1-5 + Shopify `low_stock`. Fallback: bottom 10 by quantity (any > 0).
- **Promotions** — pulls from active `promotion_campaigns` (new table). If no active campaign, fallback to all in-stock products tagged "On Sale".
- **Single** — full universal pool (no restriction).

All queries cached 2 min via React Query; Best Sellers cached 5 min.

### Part 2 — Promotions Manager

**New table** `promotion_campaigns`:
- `id`, `name`, `promo_label` (Sale/Discount/Bundle/etc), `description`, `start_date`, `end_date`, `is_active`, `status` (draft/scheduled/active/expired — derived in client from dates+is_active)
- `discount_type` (`percent` | `fixed` | `override` | `none`)
- `discount_value` (numeric)
- `product_refs` jsonb — array of `{id, source: 'shopify'|'local', title, image, price}` snapshot for stable poster rendering
- `visibility` jsonb — `{posters, productPages, homepage, collections}` toggles
- `created_by`, `created_at`, `updated_at`
- RLS: admin-only ALL; public SELECT for active+visible (so storefront can read later)

**New page** `/admin/promotions` (`src/pages/admin/PromotionsManager.tsx`)
- 4 tabs: **Active · Scheduled · Expired · Drafts** (filtered by date+is_active)
- Cards list: name, label badge, dates, discount summary, product count, edit/delete
- "+ New Promotion" button → editor dialog

**Editor dialog** (`src/components/admin/PromotionEditor.tsx`)
- Fields: name, promo label dropdown, description, start/end dates, active toggle
- Discount section: type radio (Percent / Fixed / Override price / None) + value input
- Visibility toggles (4 switches)
- **Product picker**: search/select from hybrid catalog + local products, drag-reorder selected list, remove buttons
- Save = upserts row; deletes are soft via `is_active=false` if linked to live posters

**Marketing Studio integration**
- When poster type = Promotions, ProductSourceCard shows a **Campaign dropdown** ("Select promotion campaign") above the product grid
- Selecting a campaign loads its `product_refs` directly (no auto-detect)
- "Manage Promotions" link opens `/admin/promotions` in new tab

**Admin nav**
- Add "Promotions" link in admin sidebar/hub

### Part 3 — Price formatting (no decimals)

Replace `EC${item.price}` / `EC${p.price}` in `templates.tsx` with helper `formatPosterPrice(amount)` → `EC$${Math.round(Number(amount))}` (4 spots in templates, 2 spots in MarketingStudio dropdown). Also apply to product picker labels.

### Files

**New (3)**
- `src/pages/admin/PromotionsManager.tsx`
- `src/components/admin/PromotionEditor.tsx`
- `src/hooks/usePromotionCampaigns.ts`

**Edited (4)**
- `src/hooks/useMarketingProducts.ts` — universal pool + fallbacks for every type
- `src/components/marketing/ProductSourceCard.tsx` — campaign dropdown when type=promotions
- `src/components/marketing/templates.tsx` — `formatPosterPrice` helper, hide price for Best Sellers tiles
- `src/pages/admin/MarketingStudio.tsx` — wire campaign selection, route admin nav, price formatting

**Migration**
- Create `promotion_campaigns` table + RLS policies + index on `(is_active, start_date, end_date)`

### Best Sellers special handling
- Hide price column entirely on Best Sellers poster type (templates check `posterType === 'bestsellers'` → `showPrice=false` and inject `hint = "{n} sold"` on each tile)
- Show product image + name + qty sold only

### Manual override (already supported)
- ProductSourceCard already lets admin tap tiles to toggle selection — keep this behavior. Empty-state UI gets a "Browse all products" button that opens the universal product picker fallback.

### Out of scope
- Auto-applying promotion discount to checkout (that lives in existing discount system)
- Storefront promo pages (visibility toggles stored but not yet rendered on customer-facing pages)
- Bundle pricing logic
- Promotion analytics

