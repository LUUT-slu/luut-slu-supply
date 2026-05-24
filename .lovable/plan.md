## Goal
Add a dedicated, admin-controlled "Promo Collection" homepage section that surfaces clearance/promo items together, auto-prioritizes to the top when a linked promotion is active, and gracefully hides/reverts when nothing is on sale.

## 1. New section type: `promo_collection`

Extend `HomepageSection["type"]` in `src/hooks/useSiteSettings.ts` with `"promo_collection"`, plus new optional fields:
- `promoCollectionHandle?: string` — Shopify collection (or local category slug) the section pulls from
- `autoPrioritize?: boolean` — when true and a matching active promotion exists, move to top
- `emptyStateMessage?: string` — shown only in admin preview; on storefront an empty section just hides
- `badgeLabel?: string` — override badge text (defaults to active promotion's `badge_text` / `promo_label`, falling back to "SALE")

Reuses existing `label`, `subtitle`, `limit`, `enabled`.

## 2. Admin editor (`src/components/admin/HomepageEditor.tsx`)
- Add `{ value: "promo_collection", label: "Promo / Clearance Collection" }` to `SECTION_TYPES`.
- Add "+ Add Promo Collection" button.
- When rendering a `promo_collection` row, show:
  - Title + subtitle inputs (reuse existing)
  - Collection selector (reuse `useShopifyCollections`)
  - Max products input (reuse `limit`)
  - Show/hide toggle (reuse `enabled`)
  - "Auto-prioritize when promotion is active" switch
  - Optional badge override input
  - Helper text showing whether a currently active promotion targets this collection (live preview hint via `useActivePromotionCampaigns`)

## 3. New frontend component: `src/components/home/PromoCollectionSection.tsx`
- Props: `slug`, `label`, `subtitle`, `limit`, `badgeLabel?`, `matchedCampaign?`
- Uses `useHybridProducts({ categorySlug: slug, limit: limit * 3 })` then filters via `resolveProductPrice` (from `src/lib/pricing.ts`) to keep only products with `hasDiscount === true`, then slices to `limit`.
- Renders the same `UnifiedProductCard` grid as `HomeCategorySection` so existing strikethrough/sale ribbon logic already works.
- Section header includes a SALE/CLEARANCE chip (uses `matchedCampaign?.badge_text || badgeLabel || matchedCampaign?.promo_label || "SALE"`) and an optional countdown if `matchedCampaign.end_date` is set (reuses `useCountdown`).
- "View All" link points to `/shop/{slug}`.
- If 0 discounted products resolved → return `null` (section hides automatically).

## 4. Active promotion priority logic
In `src/pages/Index.tsx` (desktop renderer block):
- Pull `useActivePromotionCampaigns()`.
- Build a helper `getPromoSectionPriority(section, campaigns)`:
  - For each `promo_collection` section, find campaigns whose `target_mode === "collections"` and `target_collections.includes(section.promoCollectionHandle)`.
  - Returns the highest `priority` of matches, or `null` if none.
- Compute display order:
  1. Start from `layout.sections.filter(s => s.enabled)`.
  2. Stable-sort so that `promo_collection` sections with a matching active campaign AND `autoPrioritize` move to the front, ordered by highest campaign `priority` desc.
  3. Other sections keep their admin-defined order.
- Add `case "promo_collection":` to the section switch, rendering `<PromoCollectionSection ... matchedCampaign={...} />`.
- Mobile (`MarketplaceFeed`) is untouched per scope; this is a homepage-sections feature.

## 5. Collection page behavior
No new route needed — `/shop/:slug` already exists and renders the chosen collection. The promo section just deep-links there. Customers clicking "View All" land on the standard collection page, where existing `UnifiedProductCard` discount resolution shows the sale prices.

## 6. No DB migration required
All targeting/priority data already lives in `promotion_campaigns` (`target_mode`, `target_collections`, `priority`, `badge_text`, `end_date`). Section configuration lives in `site_settings.homepage_layout` JSON, which is schemaless.

## 7. Out of scope (explicit)
- Mobile `MarketplaceFeed` reordering — keeps current behavior.
- Changes to `PromotionEditor` / `PromotionsManager` UI — admins already set `target_collections` + `priority` there.
- Cart/checkout pricing — already handled in earlier promo pass.
- Visual redesign of cards or homepage chrome.

## Files touched
- `src/hooks/useSiteSettings.ts` — extend `HomepageSection` type, add defaults.
- `src/components/admin/HomepageEditor.tsx` — new section type UI + add button.
- `src/components/home/PromoCollectionSection.tsx` — **new**.
- `src/pages/Index.tsx` — render new case + auto-prioritize ordering.

## Verification
- Add a Promo Collection section in admin → save → appears in normal order on homepage if no matching active promotion.
- Activate a campaign with `target_mode=collections`, `target_collections=[handle]`, `is_active=true` → that section jumps to top of homepage.
- Deactivate the campaign → section returns to its saved position (or hides if no discounted products remain).
- Two active campaigns on different collections → higher `priority` section appears above the lower one.
- All product cards show strikethrough + discounted price + SALE ribbon (already wired via `useResolvedPrice`).