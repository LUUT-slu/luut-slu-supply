

## Marketing Studio - Plan

### Goal
Add an admin "Marketing Studio" that turns existing product listings (Shopify + local) into ready-to-export IG Stories, posts, ad creatives, and copy — without leaving the site.

### Where it lives
- **New route:** `/admin/marketing-studio` (admin-only, behind `RouteGuard`)
- **Hub link:** Add "Marketing Studio" card to `AdminHub.tsx`
- **Per-product entry:** Add a "Promote" button on each product row in `AdminProductsPage.tsx` that opens Marketing Studio with that product preselected (`?productId=...`)

### Page Layout (mobile-first)
```text
┌─────────────────────────────────┐
│  Marketing Studio               │
│  [Search/Pick a product ▾]      │
├─────────────────────────────────┤
│  Tabs:  Story | Post | Ad | Copy│
│                                 │
│  Left: live preview canvas      │
│  Right (or below on mobile):    │
│    - Style picker (3 templates) │
│    - Branding controls          │
│    - Generated text + Copy btns │
│    - Download PNG button        │
└─────────────────────────────────┘
```

### Features

**1. Product picker**
Reuses the existing hybrid catalog (`useHybridProducts` + `seller_products`). One searchable dropdown — image, name, price, stock pulled directly from the listing. No re-entry.

**2. Story / Post / Ad image generator (client-side)**
Renders an HTML/CSS template into a real canvas using **`html-to-image`** (lightweight, no native deps), then downloads as PNG.
- Story: 1080×1920 (9:16)
- Post: 1080×1080 (1:1)
- Ad: 1200×628 (1.91:1)

Three reusable visual styles per format:
- **Clean** — white bg, big product image, minimal type
- **Hype/Drop** — black bg, neon accents, "DROP / NEW IN" tag, urgency text
- **Minimal Spotlight** — soft gradient bg, centered product, tiny price chip

Each template pulls: image, name, price (toggleable), short description, stock badge, meetup chip, brand text.

**3. AI copy generators (one new edge function: `ai-marketing-copy`)**
Single function with a `type` field that returns structured JSON via tool-calling. Types:
- `ad_copy` → `{ headline, primary_text, short_description, cta }`
- `instagram_caption` → `{ caption, hashtags[] }`
- `whatsapp_promo` → `{ text }`
- `facebook_marketplace` → `{ description }`

Uses `google/gemini-3-flash-preview` via the Lovable AI Gateway. Local context (Saint Lucia, Pay on Meetup, brand voice) baked into the system prompt. Each output has a "Copy" button (clipboard).

**4. Admin-controlled defaults (Site Settings → Marketing Studio)**
Stored in the existing `site_settings` table under `marketing_studio` key:
```ts
{
  brandName: "Luut SLU",
  brandLogoUrl: "",
  defaultCta: "DM to Cop",
  meetupLocations: "Castries · Gros Islet · Vieux Fort",
  urgencyText: "Limited drop",
  showPriceByDefault: true
}
```
Editable in a small new "Marketing Defaults" card in `AdminSiteSettings.tsx`. Defaults load into Marketing Studio but every field stays editable per session.

### Files

**New**
- `src/pages/admin/MarketingStudio.tsx` — main page
- `src/components/marketing/ProductPicker.tsx`
- `src/components/marketing/StoryTemplate.tsx` (renders all 3 styles, switched by prop)
- `src/components/marketing/PostTemplate.tsx`
- `src/components/marketing/AdTemplate.tsx`
- `src/components/marketing/CopyPanel.tsx` (AI generators + copy buttons)
- `src/components/marketing/MarketingDefaultsCard.tsx` (for Site Settings)
- `supabase/functions/ai-marketing-copy/index.ts`

**Edited**
- `src/App.tsx` — register `/admin/marketing-studio`
- `src/pages/AdminHub.tsx` — add "Marketing Studio" tile
- `src/pages/AdminProductsPage.tsx` — add "Promote" action per product row
- `src/pages/AdminSiteSettings.tsx` — mount `MarketingDefaultsCard`
- `src/hooks/useSiteSettings.ts` — add `marketingStudio` settings type
- `package.json` — add `html-to-image`

### Technical notes
- **No DB migration needed** — uses existing `site_settings` row pattern.
- **Image export**: `html-to-image` works against a hidden but rendered DOM node sized to exact target dimensions; CSS `transform: scale()` shows a smaller preview without affecting export resolution.
- **CORS for product images**: Shopify CDN images need `crossOrigin="anonymous"` on `<img>` tags so canvas export doesn't taint. Already standard practice.
- **Mobile preview**: Templates render in a `transform: scale(0.3)` wrapper on small screens so the 1080×1920 story still fits the viewport.
- **Failure isolation**: AI failures show inline error toast — image export still works without copy, copy still works without export.

### Out of scope (explicit)
- Direct posting to Instagram/Facebook (requires Meta Graph API + business accounts — separate feature)
- Video story export
- Multi-product carousels
- Scheduled posts

