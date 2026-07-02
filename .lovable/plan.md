## Goal
Replace loading spinners across the app with shadcn `Skeleton` placeholders that mirror each view's real layout, using the built-in pulse animation for a subtle "something is loading" cue.

## Approach: phased rollout
To avoid runtime errors from touching too much at once, ship this in 3 phases. Each phase is independently testable.

### Phase 1 — Product listing & grids (customer-facing)
Highest visibility, lowest risk. Replace the centered spinner with grid-shaped skeleton cards matching `UnifiedProductCard` (square image + 2 text lines + price line).

Files:
- `src/components/ui/skeleton.tsx` — keep as-is (already uses `animate-pulse`).
- New: `src/components/skeletons/ProductCardSkeleton.tsx` — mirrors `UnifiedProductCard` structure.
- New: `src/components/skeletons/ProductGridSkeleton.tsx` — renders N cards in the same responsive grid columns.
- Update `src/components/HybridProductGrid.tsx` — swap `Loader2` for `ProductGridSkeleton`.
- Update `src/components/ProductGrid.tsx` — same swap.
- Update `src/components/home/MarketplaceFeed.tsx` — replace the existing gray squares with `ProductCardSkeleton` so text rows are also placeheld.
- Update `src/pages/CategorySub.tsx`, `src/pages/CategoryMain.tsx`, `src/pages/Shop.tsx`, `src/pages/BestSellers.tsx` — swap the in-body `Loader2` for `ProductGridSkeleton`.
- Also add skeletons to `WhatPeopleAreBuyingSection` and `BestSellersSection` where applicable.

### Phase 2 — Product detail page
Replace the full-page spinner in `src/pages/ProductDetail.tsx` and `src/pages/LocalProductDetail.tsx` with a layout-matched skeleton:
- Left: square image block + thumbnail row
- Right: title line, price line, seller line, variant chips, CTA button block, description lines

New: `src/components/skeletons/ProductDetailSkeleton.tsx`.

### Phase 3 — Dashboards & admin/seller views
Replace spinners with layout-shaped skeletons in:
- Seller: `SellerDashboard`, `SellerDashboardNew`, `SellerOrders`, `SellerOrderDetail`, `SellerProducts`, `SellerAnalytics`, `SellerSettingsPage`, `SellerPendingNew`, `SellerApply`
- Admin: `AdminHome`, `AdminOrdersPage`, `AdminOrders`, `AdminProductsPage`, `AdminSellers*`, `AdminSellerRequests`, `AdminSiteSettings`, `ManagePartners`, `PartnerPortal`, `PartnerDashboard`, `AssignedOrdersPage`, `LuutConnectAdmin`
- Customer: `MyOrders`, `OrderDetails`, `OrderStatus`, `Checkout`, `Cart`, `SellerProfile`

Shared building blocks (new files under `src/components/skeletons/`):
- `StatCardSkeleton.tsx` (dashboard KPI cards)
- `TableRowSkeleton.tsx` (orders/products tables — accepts `columns` and `rows`)
- `FormSkeleton.tsx` (settings/edit views)
- `PageHeaderSkeleton.tsx` (title + breadcrumb line)

Each dashboard/list view composes these to match its real layout.

### Out of scope
- Route-level guard spinners (`RouteGuard`, `SellerRouteGuard`, `AuthCallback`, `AdminAuth`, `Login`) — these are auth gates that flash for <100ms and don't reveal page layout; leaving these as spinners is intentional.
- Small inline button spinners (submit buttons in dialogs like `CreateOrderDialog`, `EditOrderDialog`, `ReviewPopup`) — these belong on the button itself, not a skeleton.
- Modal-internal AI generation spinners (`AIListingAssistant`, `AIOrderHelper`, marketing studio generation) — progress indicators, not content loads.

## Technical notes
- `Skeleton` already applies `animate-pulse rounded-md bg-muted` — no CSS changes needed.
- Skeletons will use the exact same Tailwind grid classes as the real layout so column counts match at every breakpoint.
- Keep `hideWhenEmpty` behavior in `HybridProductGrid` — no skeleton when parent expects silent fallback.
- Preserve `min-h-[300px]` sizing to prevent layout jumps.

## Rollout order
Ship Phase 1, verify build + preview, then Phase 2, then Phase 3. If any phase breaks, we isolate the fix to that view set without touching the others.