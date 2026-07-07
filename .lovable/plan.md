
# Admin Hub Audit & Reorganization Proposal

## (a) Hub cards that exist today

Current `/admin` (AdminHome) shows 15 cards:

1. **Manage Sellers** → sub-links `/admin/approvals`, `/admin/sellers`
2. **Customer Info** → `/admin/customers` (already consolidated ✓)
3. **Order Management** → `/admin/orders`
4. **Partner Management** → `/admin/partners`
5. **All Products** → `/admin/products`
6. **Dispatch Control Tower** → `/connect`
7. **Analysis** → `/admin/analytics`
8. **Site Settings** → `/admin/site-settings`
9. **Reviews** → `/admin/reviews`
10. **Marketing Studio** → `/admin/marketing-studio`
11. **Promotions Manager** → `/admin/promotions`
12. **Purchase Orders** → `/admin/purchase-orders`
13. **Category Images** → `/admin/category-images`
14. **Seller Portal** → `/seller/dashboard` (personal shortcut)
15. **Main Storefront** → `/`

## (b) Orphaned / invisible / dead pages

**Routed but NOT linked from the hub (URL-only):**
- `/admin/connection-health` — Shopify diagnostics page, no card
- `/admin/content-library` — AI image library, only reachable inside Marketing Studio
- `/admin-orders` — duplicate route to `AdminOrdersPage` (legacy alias)
- `/admin/unclaimed-customers` — now a redirect to `/admin/customers?tab=unclaimed` (fine to keep as bookmark redirect)

**Files that exist but are not routed anywhere (fully dead code):**
- `src/pages/AdminHub.tsx` — older hub prototype, superseded by AdminHome
- `src/pages/admin/MarketingControl.tsx` — points to non-existent `/admin/marketing/discounts` and `/admin/marketing/popups`
- `src/pages/admin/DiscountsManager.tsx` — never routed
- `src/pages/admin/PopupsManager.tsx` — never routed (discounts + popups live inside AdminSiteSettings instead)
- `src/pages/AdminOrders.tsx` — old, replaced by `AdminOrdersPage.tsx`
- `src/pages/AdminSellers.tsx` — old, replaced by `AdminSellersNew.tsx`
- `src/pages/AdminLogin.tsx` — auth flow now uses `/seller-auth` / `/auth`

## (c) Duplication / overlap

- **Orders**: `/admin/orders` and `/admin-orders` both render `AdminOrdersPage`. Second route is legacy and should be removed (or 301'd).
- **Sellers**: three files exist — `AdminSellersNew` (live), `AdminSellers` (dead), `AdminSellerRequests` (live, at `/admin/approvals`). "Manage Sellers" card exposes both approvals and directory as sub-links but they're really two views of the same subject.
- **Marketing surface is fragmented**: Marketing Studio, Content Library, Promotions Manager, Category Images, and the Discounts/Popups sections inside Site Settings are all marketing-adjacent but scattered across 4 cards + a settings subtab.
- **Analytics vs. Connection Health**: both are "operational health" views but live in unrelated places (one has a card, one is orphaned).
- **Orders vs. Purchase Orders vs. Dispatch**: three separate order-adjacent cards — customer orders, stock buys, and partner dispatch — that all deal with order lifecycles.

## Recommended reorganization — 8 cards, everything tabbed inside

```
Admin Hub
├── 1. Orders & Fulfillment
│      tabs: Customer Orders │ Dispatch (Partners jobs) │ Purchase Orders │ Reports
│      merges: /admin/orders, /connect, /admin/purchase-orders(+reports), /admin-orders (drop)
│
├── 2. Customer Info  ✓ (already done)
│      tabs: Directory │ Claimed │ Unclaimed │ Spend │ Loyalty │ Signups
│
├── 3. Sellers & Partners
│      tabs: Seller Approvals │ Verified Sellers │ Delivery Partners
│      merges: /admin/approvals, /admin/sellers, /admin/partners
│      (Dispatch stays under Orders since it's operational, not roster)
│
├── 4. Catalog
│      tabs: All Products │ Category Images │ Reviews
│      merges: /admin/products, /admin/category-images, /admin/reviews
│
├── 5. Marketing
│      tabs: Promotions │ Marketing Studio │ Content Library │ Discounts │ Popups
│      merges: /admin/promotions, /admin/marketing-studio, /admin/content-library,
│              + Discounts and Popups sections lifted out of Site Settings
│      (retires dead MarketingControl / DiscountsManager / PopupsManager files)
│
├── 6. Analytics & Health
│      tabs: Sales & Traffic │ Shopify Connection Health │ Sync Status
│      merges: /admin/analytics, /admin/connection-health (currently orphaned)
│
├── 7. Site Settings
│      keeps: hero, homepage editor, checkout controls, product visibility
│      loses: discounts, popups (moved to Marketing)
│
└── 8. Shortcuts (not a card group — small footer row)
       "My Seller Dashboard" • "Open Storefront"
```

### Cleanup to do alongside the reorg
- Delete dead files: `AdminHub.tsx`, `MarketingControl.tsx`, `DiscountsManager.tsx`, `PopupsManager.tsx`, `AdminOrders.tsx`, `AdminSellers.tsx`, `AdminLogin.tsx`.
- Remove the duplicate `/admin-orders` route (keep `/admin/orders`).
- Keep `/admin/unclaimed-customers` and `/admin/connection-health` as valid URLs so old bookmarks still work; just make sure everything is *also* reachable from a hub card.

### Assumptions to confirm
- Site Settings currently owns Discounts and Popups as inline sections; my plan moves those into the Marketing card. If you'd rather keep them in Site Settings, we drop them from card 5.
- Dispatch belongs under Orders (operational routing), not under Sellers & Partners (roster management). Say the word if you'd prefer it under Partners.
- Card 8 shortcuts can stay as full-size cards if you'd rather not shrink them.

If you approve, next step is a build-mode pass that: creates tabbed shells for cards 1, 3, 4, 5, 6; migrates the existing pages' content into tabs; updates AdminHome to the 8-card layout; and deletes the dead files.
