
# Marketplace Category Restructure

Move from a hardcoded clothing-only list to a **dynamic, multi-level taxonomy** sourced entirely from Shopify, with marketplace-style navigation and auto-hidden empty categories. Clothing remains the prominent experience; all other verticals quietly come online as inventory appears.

---

## 1. Source of Truth: Shopify

Stop hardcoding categories in `src/lib/categories.ts`. Categories are derived from Shopify at runtime + cached via React Query.

**Mapping convention (managed in Shopify, no code changes needed):**

- **Level 1 (Main category)** = Shopify collection with handle prefixed `main-` (e.g. `main-clothing`, `main-electronics`, `main-vehicles`) **OR** a `category.level:1` tag.
- **Level 2 (Subcategory)** = Shopify collection with `parent:<main-handle>` metafield (namespace `luut`, key `parent`) **OR** handle pattern `<main>--<sub>` (e.g. `clothing--beanies`, `electronics--phones`).
- Products are assigned by adding them to the relevant L2 collection in Shopify. Optional tags `vertical:clothing`, `subcategory:beanies` give a fallback path.

This means: add a product → assign collection in Shopify → site updates automatically (no code edit).

For local seller products (`seller_products` table), add two nullable text columns: `main_category` and `sub_category` so they slot into the same taxonomy.

---

## 2. New Taxonomy Layer (code)

New file `src/lib/taxonomy.ts`:

- `fetchTaxonomy()` — single call that pulls all Shopify collections + their metafield/tag info, builds a tree:

```text
Main (Clothing)
├── Sub (Beanies)        productCount: 12
├── Sub (Hoodies)        productCount: 4
└── Sub (Shoes)          productCount: 0   ← hidden
Main (Electronics)       ← hidden if all subs empty
└── Sub (Phones)         productCount: 1
```

- Counts come from Shopify `collection.products.count` (Storefront API) + a Supabase aggregate of `seller_products` grouped by `(main_category, sub_category)`.
- Visibility rule applied here: a sub is shown if `productCount > 0`; a main is shown if it has at least one visible sub.
- `usePriorityOrder()` keeps Clothing / Streetwear / Sneakers / Accessories pinned to the front; other verticals follow alphabetically.

New hook `src/hooks/useTaxonomy.ts` wraps it with React Query (10-min stale, lazy on idle).

Delete the static `PRODUCT_CATEGORIES` list from `src/lib/categories.ts`; keep only helper functions (`normalizeCategoryForStorage`, slug helpers) and have them read from the cached taxonomy.

---

## 3. Navigation UX

**Desktop — Mega menu** (`src/components/MegaNav.tsx`, replaces the flat `<nav>` in `Header.tsx`):

- Hover/focus on a main category opens a panel listing its visible subs in 2–3 columns, each with a thumbnail (collection image) + product count.
- Pinned shortcuts row: New Arrivals, Best Sellers, Sellers, Sell on Luut.

**Mobile — Expandable drawer** (update existing `Sheet` in `Header.tsx`):

- Replace the flat `outfitCategories` list with an accordion: tap a main to expand subs, tap sub to navigate. Uses shadcn `Accordion`.
- Lazy: only fetches taxonomy when the drawer opens.

---

## 4. Routing & Auto-Generated Pages

New routes (add in `src/App.tsx`):

- `/c/:main` — main-category landing (grid of visible subs + featured products).
- `/c/:main/:sub` — subcategory product grid (replaces ad-hoc `/shop/:category`).
- Keep existing `/shop/:category` working via a redirect to the resolved `/c/:main/:sub`.

Each page renders:

- Breadcrumbs (`Home > Clothing > Beanies`)
- H1 with category name + product count
- Sort dropdown (Newest, Price ↑/↓, Best Selling) — passes `sortKey`/`reverse` to `fetchProducts`
- Filter sidebar (see §5)
- SEO: per-page `<title>`, meta description, canonical, JSON-LD `BreadcrumbList` + `CollectionPage`

---

## 5. Modular Filter System

New `src/components/filters/` directory with a registry pattern:

```text
filters/
  registry.ts          // mainCategory → filter component[]
  ClothingFilters.tsx  // size, color, brand, gender, style
  ElectronicsFilters.tsx // brand, storage, condition
  VehicleFilters.tsx     // brand, year, mileage, transmission
  CommonFilters.tsx      // price range, in-stock toggle
```

Filter values are pulled from product **variant options** (already in Shopify response — `options` + `selectedOptions`) and product **tags** (`brand:nike`, `condition:new`, `year:2020`). Adding a new vertical = add one component + register it; no other code needs to change.

State lives in URL search params so filters are shareable and SEO-friendly.

---

## 6. Clothing-First Priority

- Homepage continues to feature the clothing experience: hero, "IN STOCK NOW", outfit categories.
- Add a **"Explore the Marketplace"** strip below the clothing sections that renders main categories only when they have ≥1 product (uses the same taxonomy hook). On a fresh store this simply doesn't render.
- Streetwear / Sneakers / Trending sections stay as-is and become curated Shopify collections (`featured-streetwear`, `featured-sneakers`).

---

## 7. Marketplace Future-Readiness (structure only, no UI)

DB migration (separate plan once approved):

- `seller_products`: add `main_category text`, `sub_category text`, index both.
- Optional new table `category_overrides` (admin-curated display name / image / order overrides keyed by Shopify handle) — not built now, just reserved.

This keeps every product (Shopify or local) addressable by `(main, sub)` so future seller storefronts and service/digital listings drop in cleanly.

---

## 8. Performance

- Single taxonomy fetch, React Query cached 10 min, deduped across header/menu/pages.
- Empty collections never render (no wasted requests).
- Category pages: `React.lazy` + `Suspense`, image `loading="lazy"` for non-priority cards.
- Filters compute client-side from already-loaded products (no extra calls).

---

## 9. Files Touched

**New**
- `src/lib/taxonomy.ts`
- `src/hooks/useTaxonomy.ts`
- `src/components/MegaNav.tsx`
- `src/components/MobileCategoryDrawer.tsx`
- `src/components/filters/{registry,ClothingFilters,ElectronicsFilters,VehicleFilters,CommonFilters}.tsx`
- `src/pages/CategoryMain.tsx`, `src/pages/CategorySub.tsx`

**Edited**
- `src/components/Header.tsx` (swap flat nav for MegaNav + drawer)
- `src/lib/categories.ts` (strip static list, keep helpers)
- `src/lib/products.ts` (filter by `(main, sub)` instead of single slug)
- `src/components/HomeCategorySection.tsx` (use taxonomy + hide-if-empty)
- `src/App.tsx` (new routes + redirect)
- `src/pages/Shop.tsx`, `src/pages/ShopCategory.tsx` (redirect or rebuild on new taxonomy)

**DB migration (after plan approval)**
- Add `main_category`, `sub_category` to `seller_products`.

---

## 10. Rollout

1. Build taxonomy layer + hook (no UI change yet).
2. Add `/c/:main/:sub` routes alongside existing ones.
3. Swap Header nav to mega menu / drawer.
4. Migrate `seller_products` schema.
5. Redirect legacy `/shop/:category` → new routes.
6. Document the Shopify collection-naming convention in README so the user can manage everything from Shopify going forward.

---

### Open questions before building

1. **Taxonomy convention** — OK with `main-<slug>` / `<main>--<sub>` collection handles, or prefer Shopify **metafields** (`luut.parent` on each collection)? Metafields are cleaner but require setup in Shopify admin.
2. **Legacy URLs** — keep `/shop/:category` permanently (redirect) or sunset after migration?
3. **Initial main categories** — should I seed the Shopify side with the full L1 list now (Clothing, Electronics, Vehicles, …) so the structure is visible even when empty (with a "Coming soon" tag), or strictly hide until products exist?
