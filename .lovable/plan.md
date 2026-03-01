

## Plan: 1K Followers Sale Experience + Admin Site Settings

### Overview
Build a database-driven site settings system with an admin UI to control popups, checkout freeze, and sold-out product visibility. Add a premium 1K sale popup and banner to the storefront that respects these settings.

---

### 1. Database: `site_settings` table

Create a single `site_settings` table with a key-value/JSON structure:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text (PK) | Setting key (e.g. `popups`, `freeze_checkout`, `hide_sold_out`, `checkout_reminder`) |
| `value` | jsonb | Setting value |
| `updated_at` | timestamptz | Last modified |
| `updated_by` | uuid | Admin who changed it |

Seed initial rows:
- `popups` → `[{ "id": "1k-sale", "name": "1K Followers Sale", "enabled": true, "frequency": "once_per_session", "startAt": null, "endAt": null, "pages": ["home", "product"], "buttonUrl": "/shop" }]`
- `freeze_checkout` → `false`
- `hide_sold_out` → `false`
- `checkout_reminder` → `{ "enabled": true, "code": "1KPROMO", "message": "Use code 1KPROMO for 15% OFF (one-time use)." }`

RLS: Admins can read/write all. Public can read (storefront needs to fetch settings).

---

### 2. Shopify Discount Setup

Create price rule + discount code `1KPROMO` via Shopify tools:
- 15% off storewide
- Once per customer
- 7-day duration

---

### 3. New Files

**`src/hooks/useSiteSettings.ts`** — React Query hook to fetch all site settings from the database. Caches with short stale time for near-instant admin updates.

**`src/components/SalePopup.tsx`** — Premium black/gold modal popup:
- "WE HIT 1K 🎉" title, code highlight, SHOP THE SALE + COPY CODE buttons
- Checks `popups` setting for enabled state, frequency, page targeting
- Uses sessionStorage/localStorage for frequency control
- Renders nothing if disabled

**`src/components/SaleBanner.tsx`** — Slim top banner above Header:
- "1K SALE: 15% OFF — Use code 1KPROMO (7 days)"
- Click copies code or opens popup
- Controlled by popup enabled state

**`src/pages/AdminSiteSettings.tsx`** — Admin page with sections:
- **Popups Manager**: List of popups with toggle, frequency selector, date pickers, page targeting
- **Freeze Checkout**: Single toggle with description
- **Hide Sold-Out Products**: Single toggle
- **Checkout Reminder**: Toggle + editable message/code

---

### 4. Modified Files

**`src/App.tsx`**:
- Add route `/admin/site-settings` with admin RouteGuard
- Add `SalePopup` component at the root level (inside BrowserRouter, reads current route)

**`src/pages/AdminHub.tsx`**:
- Add "Site Settings" card to admin modules list (Settings icon, link to `/admin/site-settings`)

**`src/pages/Index.tsx`**:
- Add `SaleBanner` component above or below Header

**`src/components/Header.tsx`**:
- Integrate `SaleBanner` as a slim bar above the main header

**`src/pages/Checkout.tsx`**:
- Read `freeze_checkout` setting; if true, disable submit button and show pause message
- Read `checkout_reminder` setting; if enabled, show reminder text near discount input

**`src/pages/Cart.tsx`**:
- Read `freeze_checkout`; if true, disable checkout button and show message
- Read `checkout_reminder`; show reminder near totals

**`src/components/UnifiedProductCard.tsx`** and **`src/components/ProductGrid.tsx`** / **`src/components/HybridProductGrid.tsx`**:
- Read `hide_sold_out` setting; filter out sold-out products from grid when enabled

**`src/pages/ProductDetail.tsx`**:
- If sold out and `hide_sold_out` is on, show product but with "Sold Out" label and hidden checkout

---

### 5. Implementation Order

1. Create `site_settings` table + seed data (migration)
2. Create Shopify 1KPROMO discount (15% off, once per customer, 7 days)
3. Build `useSiteSettings` hook
4. Build Admin Site Settings page + add route + add to Admin Hub
5. Build SalePopup component (black/gold, mobile-first)
6. Build SaleBanner component
7. Integrate freeze checkout + checkout reminder into Cart/Checkout
8. Integrate hide sold-out into product grids and product detail

### Technical Notes

- Settings fetched via React Query with `staleTime: 30000` so admin changes propagate within ~30s
- Popup frequency uses `sessionStorage` (once per session) or `localStorage` with timestamp (once per 24h)
- The popup system stores an array so future popups just need a new entry — no code changes needed for the toggle/display logic
- Black/gold styling: `bg-black text-white` with `text-yellow-400` accents for the gold elements

