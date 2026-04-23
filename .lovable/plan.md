
# Restore homepage startup and harden production boot

## Exact root cause

The live published site is not failing inside the homepage component. It is serving a broken HTML shell that never boots React:

- `fetch_website` for `https://luut-slu-supply.lovable.app` returns only the inline loader markup.
- The published HTML is missing the normal `<head>` and, most importantly, the app entry `<script type="module" src="...">`.
- Because the JavaScript bundle never loads, none of the app code runs:
  - `src/main.tsx` never executes
  - `src/App.tsx` never mounts
  - `src/pages/Index.tsx` never renders
  - no Shopify, auth, or site-settings request can be the primary blocker on the live site

The recent timeout UI added in `index.html` did not cause the outage; it only made the broken deploy visible instead of showing an endless spinner.

## What I will implement

### 1. Fix the publish/deploy path first
Goal: make the published HTML always include the built JS entry so React can start.

- Inspect the frontend build/publish setup around:
  - `index.html`
  - `vite.config.ts`
- Remove any deploy-fragile assumptions and keep the entrypoint minimal and standard.
- Republish after the frontend patch so the live deployment gets a clean build artifact.

### 2. Harden app startup so homepage renders even when integrations are slow
Even though the live outage is a broken deploy, production can still be slower than preview because several non-critical integrations mount immediately. I will reduce startup pressure so the homepage renders faster after the deployment is fixed.

Targeted changes:
- `src/App.tsx`
  - keep homepage route eager
  - move non-essential global UI behind safe/deferred mounting where possible
- `src/components/Header.tsx`
  - stop homepage header from eagerly depending on Shopify collections/auth-derived portal checks for first paint
  - use fallback nav immediately, then hydrate enhanced data after paint with timeout protection
- `src/components/SalePopup.tsx`
- `src/components/SignupDiscountPopup.tsx`
- `src/components/AIChatWidget.tsx`
  - ensure these never influence initial route render
  - defer their async work until after first paint / idle time
- `src/hooks/useSiteSettings.ts`
  - make storefront settings fetch resilient with safe defaults and timeout/error fallback
  - avoid aggressive refetch behavior on initial home render
- `src/hooks/useShopifyCollections.ts`
- `src/lib/shopify.ts`
  - add request timeout / abort handling so Shopify cannot hang indefinitely
  - fail closed to empty data, never block render

### 3. Remove hidden startup blockers from homepage-adjacent sections
These components already render mostly non-blocking, but I will harden them so failures stay isolated:

- `src/components/WhatPeopleAreBuyingSection.tsx`
- `src/components/HomeCategorySection.tsx`
- `src/components/HomeNewArrivalsSection.tsx`
- `src/components/HomeFeaturedSection.tsx`
- `src/components/HomepageReviews.tsx`

Changes:
- guarantee all async paths resolve to `[]` / defaults on timeout or error
- add concise error logging for production diagnosis
- ensure no section can keep the route visually stuck

### 4. Improve stale asset / chunk mismatch resilience
Goal: protect users when HTML and JS versions drift during publish rollout.

- Review startup handling in:
  - `src/main.tsx`
  - `src/App.tsx` (`lazyRetry`)
  - `index.html`
- Extend the current recovery pattern so version mismatch errors surface clearly and recover safely.
- Keep the timeout fallback, but make it diagnostic instead of being the only behavior.

## Why this plan matches the codebase

Current code inspection shows the homepage itself is not gated by a blocking loader:

- `src/pages/Index.tsx` renders immediately with defaults.
- `useSiteSettings()` already falls back to `DEFAULT_HERO` / default layout when data is absent.
- Homepage sections mostly render independently and return `null` on missing data.
- The heavier startup pressure is in shared layout components like `Header`, `SalePopup`, and auth/session checks.

So the implementation should focus on:
1. fixing the broken published artifact
2. reducing global startup work
3. adding timeouts/fallbacks around Shopify and auth-adjacent reads

## Likely file changes

- `index.html`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/hooks/useSiteSettings.ts`
- `src/hooks/useShopifyCollections.ts`
- `src/lib/shopify.ts`
- `src/components/Header.tsx`
- `src/components/SalePopup.tsx`
- `src/components/SignupDiscountPopup.tsx`
- `src/components/AIChatWidget.tsx`
- possibly small defensive edits in homepage section components listed above

## Verification after implementation

1. Published HTML contains full `<head>` and JS entry script again.
2. Live homepage shows real content before non-critical integrations finish.
3. If Shopify/auth/settings are slow or fail, homepage still renders with defaults/fallback sections.
4. Console logging identifies which integration timed out without crashing boot.
5. A fresh publish loads without the timeout screen, and stale asset mismatches recover cleanly.
