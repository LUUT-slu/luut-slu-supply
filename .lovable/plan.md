# Localization Selector — Country / Language / Currency

Add a homepage selector so visitors can pick their **country**, **language**, and **currency**. Saint Lucia / XCD / English remain defaults. No checkout changes in this pass.

## Scope

- Selector UI in the header (mobile + desktop) and a visible chip on the homepage hero area.
- Auto-detect on first visit, persist choice across pages and sessions.
- Pull available markets/currencies/locales from Shopify Markets via Storefront API so new markets added in Shopify appear automatically.
- Translations scaffold for **EN / FR / ES** (UI strings only — product copy still comes from Shopify in its own translations later).

## Files

**New**
- `src/lib/localization.ts` — countries list (ISO-3166 + flag emoji + dial code), currencies (ISO-4217 + symbol), languages (EN/FR/ES initial), helpers (`formatPrice`, `getDefaultsForCountry`).
- `src/stores/localeStore.ts` — Zustand store: `country`, `language`, `currency`, `hasUserOverridden`, persisted to `localStorage` under `luut-locale-v1`.
- `src/hooks/useShopifyMarkets.ts` — Storefront API query for `localization { availableCountries { isoCode name currency { isoCode } availableLanguages { isoCode endonymName } } }`. Cached 1h.
- `src/hooks/useGeoDetect.ts` — calls a free IP geo endpoint (`https://ipapi.co/json/`) once, falls back to `navigator.language` country hint, then to LC. Result cached in sessionStorage.
- `src/components/locale/LocaleSelector.tsx` — popover trigger (flag + country code + currency) → command palette with **search input**, scrollable list (`ScrollArea`), sections for Country / Language / Currency via tabs. Built on existing `Popover` + `Command` + `ScrollArea` shadcn primitives.
- `src/components/locale/LocaleDetectBanner.tsx` — small dismissible banner shown once when detected country ≠ current (e.g. "Shopping from France? Switch to FR / EUR · [Switch] [Keep XCD]").
- `src/i18n/index.ts` + `src/i18n/{en,fr,es}.json` — minimal i18n provider (custom lightweight context, no new dep) exposing `t(key)` + `useT()`. Strings limited to header/menu/selector/banner for now.

**Edited**
- `src/components/Header.tsx` — mount `<LocaleSelector />` in the right-action cluster (desktop) just before the User icon.
- `src/components/home/MobileHeader.tsx` — add a compact `<LocaleSelector compact />` button on the left of the cart icon (flag only on mobile).
- `src/components/home/MobileMenuDrawer.tsx` — add a "Region & Language" row near the bottom that opens the selector.
- `src/pages/Index.tsx` — render `<LocaleDetectBanner />` directly under `<Header />` (above hero) so international visitors see it immediately.
- `src/main.tsx` — wrap app in `<I18nProvider>`.
- `src/lib/pricing.ts` — extend `formatPrice` to accept a target currency from `localeStore` (display-only conversion uses Shopify's `@inContext` later; for now we show the original XCD price with a "(approx. {currency} {value})" hint when a non-XCD currency is selected, using a static FX table in `localization.ts` clearly marked as approximate). **No cart/checkout math changes.**

## Behavior

1. On first load, `useGeoDetect` resolves country → `localeStore` initialises to detected defaults (or LC/XCD/EN fallback) **only if** `hasUserOverridden` is false.
2. `LocaleDetectBanner` appears once when detected country ≠ LC and user hasn't chosen yet. Dismiss → sets `hasUserOverridden = true`.
3. `LocaleSelector` opens a Popover with three tabs: **Country**, **Language**, **Currency**. Each tab has its own search box + scrollable virtualised list.
   - Country list is the union of `useShopifyMarkets` results and the static fallback (so it still works if Shopify is rate-limited).
   - Picking a country auto-suggests its primary currency + language but user can override each independently.
4. All selections persist in `localStorage`; navigations and refresh keep the choice.
5. `document.documentElement.lang` is updated on language change.

## Technical notes

- Uses existing UI primitives (`Popover`, `Command`, `Tabs`, `ScrollArea`, `Input`) — no new deps.
- Flag rendering via emoji (`🇱🇨`) computed from ISO-2 code — zero asset cost.
- Shopify Markets query uses the public Storefront API and the existing `storefrontApiRequest` helper; no Admin scopes needed.
- i18n is intentionally minimal (no `react-i18next` to keep bundle small); structure allows swapping later.
- All colors via existing semantic tokens (`bg-background`, `border-primary/20`, etc.) — matches LUUT dark theme.

## Out of scope (next pass)

- Checkout currency switching and local vs international checkout buttons.
- Translating product titles/descriptions (handled by Shopify `@inContext` translations later).
- Admin UI to manage the language strings.
