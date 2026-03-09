

# Homepage CMS — Full Admin Control

## What exists today
- **HomepageEditor** in Site Settings: lets admin add/remove/reorder category sections, toggle Trending & Best Sellers, set product limits per section. Saves to `site_settings` table as `homepage_layout` JSON.
- **Index.tsx** reads `homepageLayout` from settings and renders sections dynamically.
- Hero banner is hardcoded (static image import, hardcoded buttons/text).
- No banner editor, no featured products, no auto-computed sections (trending/new arrivals).

## What we'll build

### 1. Expand the `homepage_layout` JSON schema

Add to the existing layout stored in `site_settings.homepage_layout`:

```text
{
  sections: [
    { id, type: "category"|"best_sellers"|"trending"|"new_arrivals"|"featured",
      slug?, label, limit, enabled, featuredProductIds? }
  ],
  hero: {
    imageUrl: string | null,       // uploaded or default
    heading: string,
    subheading: string,
    buttonText: string,
    buttonLink: string,
    secondaryButtonText: string,
    secondaryButtonLink: string
  }
}
```

Section types:
- **category** — existing, filters by category slug
- **best_sellers** — auto-populated from `weekly_best_sellers` view
- **trending** — auto-populated: random in-stock products (later: by views/clicks)
- **new_arrivals** — auto-populated: newest products by created_at
- **featured** — manually picked product IDs

### 2. Hero Banner Editor (new component)
Inside `HomepageEditor`, add a collapsible "Hero Banner" card:
- Upload/change banner image (stored in `seller-assets` bucket under `homepage/`)
- Edit heading, subheading, primary button text + link, secondary button text + link
- All saved as part of `homepage_layout.hero`

### 3. Enhanced Section Editor
Upgrade `HomepageEditor` to support:
- **Section type picker**: Category, Best Sellers, Trending, New Arrivals, Featured
- **Drag-and-drop reordering** (keep arrow buttons as they work; no extra dependency needed)
- **Featured products**: when type is "featured", show a product search/picker that queries `seller_products` and displays selectable cards with IDs stored in `featuredProductIds[]`
- **Per-section limit** (already exists)
- **Per-section enable/disable** (already exists)

### 4. Homepage rendering updates
Update `Index.tsx` to:
- Read `hero` config from settings and render dynamic banner (image URL, text, buttons)
- Render section types dynamically:
  - `category` → existing `HomeCategorySection`
  - `best_sellers` → existing `BestSellersSection`
  - `trending` → existing `WhatPeopleAreBuyingSection` (pass limit)
  - `new_arrivals` → new `NewArrivalsSection` component (fetch newest products)
  - `featured` → new `FeaturedSection` component (fetch by product IDs)
- Remove hardcoded ordering; all sections come from the layout array in order

### 5. Auto-updating sections
- **Best Sellers**: already auto-computed from `weekly_best_sellers` view — no change needed
- **New Arrivals**: query `seller_products` + Shopify sorted by `created_at DESC`, limited
- **Trending**: currently random shuffle of in-stock items; keep this for now (views/clicks tracking already exists in `seller_products.views_count` / `clicks_count` — can sort by those later)

### 6. New components & file changes

| File | Action |
|---|---|
| `src/hooks/useSiteSettings.ts` | Expand `HomepageLayout` type with `hero` config and new section types |
| `src/components/admin/HomepageEditor.tsx` | Add hero editor, section type picker, featured product picker |
| `src/components/admin/HeroBannerEditor.tsx` | New — image upload + text fields for hero |
| `src/components/admin/FeaturedProductPicker.tsx` | New — search & select products by ID |
| `src/components/HomeFeaturedSection.tsx` | New — renders manually picked products |
| `src/components/HomeNewArrivalsSection.tsx` | New — renders newest products |
| `src/pages/Index.tsx` | Dynamic hero + dynamic section renderer |

### 7. No database migration needed
All config lives in the existing `site_settings` JSON column. Hero images upload to the existing `seller-assets` public bucket.

### Technical notes
- Hero image upload uses Supabase Storage (`seller-assets` bucket, path `homepage/hero-{timestamp}.webp`)
- Featured product picker queries `seller_products` table + optionally Shopify products
- Section ordering is array-index-based (already implemented with up/down arrows)
- All changes are admin-only (existing RLS on `site_settings` requires admin role for writes)

