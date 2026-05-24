# Wire active promotions into prices everywhere

## Problem

`promotion_campaigns` already stores discount rules (percent / fixed / override) and `product_refs`, but nothing on the storefront actually reads them. Cards and the product detail page render `node.priceRange.minVariantPrice` raw, so customers always see the original price even when a promo is "Active". The Promotions Manager today also can't target a whole collection/category or pick a clearance flag.

## Solution overview

Add a single pricing layer that every product view consumes:

```
promotion_campaigns ──► useActivePromotions() ──► resolveProductPrice(product)
                                                       │
                                                       ├─► UnifiedProductCard
                                                       ├─► ProductCard (Shopify)
                                                       ├─► BestSellerCard / variants
                                                       ├─► ProductDetail (Shopify + Local)
                                                       ├─► CartDrawer / Cart / Checkout line items
                                                       └─► SaleBanner / SalePopup / Clearance section
```

One source of truth, no hard-coded discounts, instantly reactive when admin toggles a promo off.

## 1. Data model: add targeting + badge fields

Migration on `promotion_campaigns`:

- `target_mode text not null default 'products'` — `'products' | 'collections' | 'categories' | 'sitewide'`
- `target_collections text[] not null default '{}'` — Shopify collection handles (e.g. `beanies`, `shoes`)
- `target_categories text[] not null default '{}'` — local category slugs
- `badge_text text` — overrides `promo_label` on the card (e.g. "CLEARANCE")
- `banner_text text` — short text the banner/popup component uses
- `cta_url text` — link the banner button goes to (collection page or `https://wa.me/c/17587185478`)
- `priority int not null default 0` — manual tie-breaker; combined with the rule below
- `exclude_product_ids text[] not null default '{}'` — opt-out specific items from a collection/sitewide promo

`product_refs` keeps its current shape (specific products win first regardless of priority value).

RLS already allows public SELECT on active campaigns — no policy change needed.

## 2. Shared pricing helper

New file `src/lib/pricing.ts`:

```ts
export interface ResolvedPrice {
  original: number;           // EC$ original
  final: number;              // EC$ after discount
  hasDiscount: boolean;
  savings: number;
  percentOff: number;
  badge?: string;             // e.g. "SALE", "CLEARANCE"
  promoName?: string;
  promoDescription?: string;
  campaignId?: string;
}

export function resolveProductPrice(
  product: { id: string; price: number; collectionHandles?: string[]; category?: string | null; vendor?: string },
  activeCampaigns: PromotionCampaign[],
): ResolvedPrice
```

Matching priority (first match wins, no stacking):

1. Specific `product_refs.id === product.id`
2. `target_mode='collections'` and any handle in `target_collections` matches `product.collectionHandles`
3. `target_mode='categories'` and `target_categories` includes `product.category`
4. `target_mode='sitewide'`
5. Ties → higher `priority`, then most recently created

Discount math:

- `percent` → `final = original * (1 - value/100)`
- `fixed` → `final = max(0, original - value)`
- `override` → `final = value`
- `none` → no discount (still surfaces the badge if visibility allows)

Floor at `0`, round to 2 decimals.

New hook `src/hooks/useActivePromotions.ts` wraps `useActivePromotionCampaigns` plus a `useResolvePrice(product)` convenience that memoises per product id.

## 3. Surface the discount in every product view

| File | Change |
|---|---|
| `src/components/UnifiedProductCard.tsx` | Replace the `EC$X.XX` block with original (line-through, muted) + final (primary, larger) + sale badge (mobile + desktop variants) |
| `src/components/ProductCard.tsx` | Same treatment |
| `src/components/BestSellerCard.tsx` | Same treatment |
| `src/pages/ProductDetail.tsx` | Show original/final + promo badge + `promoDescription` line under price; pass `final` into cart add |
| `src/pages/LocalProductDetail.tsx` | Same |
| `src/components/CartDrawer.tsx`, `src/pages/Cart.tsx`, `src/pages/Checkout.tsx` | Recompute line totals from `resolveProductPrice` so the order total + Shopify Draft Order line items use the discounted amount; install/setup fees stay un-discounted |
| `src/stores/cartStore.ts` | Store original unit price + resolved unit price on each line so the cart survives promo expiry mid-session (lock at add-time, but UI re-resolves until checkout submit) |

## 4. Banner / popup / clearance section

- `src/components/SaleBanner.tsx` and `src/components/SalePopup.tsx`: read first active campaign with `visibility.posters` or `visibility.homepage`, show `banner_text || description || name`, button label "View deals", `href = cta_url || /shop?promo=<id>`. If checkout is paused (existing site setting), point CTA to `https://wa.me/c/17587185478` with "Order on WhatsApp".
- New `src/components/home/ClearancePromoSection.tsx` rendered inside `MarketplaceFeed`: appears only when there's at least one active campaign with `promo_label` "Clearance" or `visibility.homepage`. Grid of the campaign's discounted products using `UnifiedProductCard`.

## 5. Promotions Manager UI additions

Extend `PromotionEditor.tsx`:

- `Target` radio: Specific products / Collections / Categories / Sitewide → shows the matching picker (product search stays, plus a Shopify-collection multiselect from `useShopifyCollections`, and a category multiselect from existing `PRODUCT_CATEGORIES`).
- Inputs for `badge_text`, `banner_text`, `cta_url`, `priority`, and an `Exclude products` picker for collection/sitewide promos.
- The existing Visibility switches stay; tooltip text updated to make clear they control where the *banner/popup* shows, not whether the discount applies (prices apply whenever the promo is active).

`PromotionsManager.tsx` card shows the new target summary (e.g. "Collections: Beanies, Shoes").

## 6. Collection-handle awareness for matching

`UnifiedProduct` already carries `category`, but not Shopify collection handles. Update `shopifyToUnified` (`src/lib/products.ts`) to also pass through `node.collections.edges[].node.handle` when present (it isn't always queried — add `collections(first: 5){edges{node{handle}}}` to the Storefront query in `src/lib/shopify.ts`). Local products use `seller_products.category` / `main_category` for matching.

## 7. Test pass

Manually verify with the seven scenarios from the request (Furry Mask $40→$30, Regular Beanie $30→$20, Designer Beanie $110→$75, Glasses $60→$40, Nike Shox NZ $300→$200, Car Sticker $40→$30, install fee untouched at $10). Toggle the campaign off in admin → prices snap back everywhere within the 60s query cache (or immediately after invalidation on the editor save).

## Out of scope

- No redesign of cards / pages beyond adding the price-pair + badge.
- No change to Shopify-side native price rules (`manage-discounts` edge function stays as-is for code-based discounts at checkout).
- No stacking logic.
