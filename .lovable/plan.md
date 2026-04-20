

## Admin Alert Email System - Expansion Plan

### Overview
Build a single, generic `send-admin-alert` edge function that handles all admin notification types. Wire it into existing success points across the app. All alerts route to `usual.suspect.118@gmail.com`. Keep the existing `send-merchant-order-email`, `send-order-email`, and `send-welcome-email` flows untouched.

### Architecture

**One unified function** (`supabase/functions/send-admin-alert/index.ts`) that accepts:
```ts
{ type: "seller_application" | "customer_signup" | "review_submitted" | "seller_product" | "low_stock" | "payment_issue" | "order_status_change", payload: {...} }
```

It builds a clean, mobile-friendly HTML email per type, using a shared template (header/footer/rows) and sends via Resend with `RESEND_FROM_EMAIL` (fallback to `onboarding@resend.dev`). Failures are logged only — never thrown back to callers.

All triggers are **fire-and-forget** (`.catch(() => {})`) so the main user flow is never blocked.

### Events Mapped to Existing Flows

| # | Event | Trigger Point | Subject |
|---|-------|---------------|---------|
| 1 | New order created | Already covered by `send-merchant-order-email` (untouched) | — |
| 2 | New seller application | After insert in `SellOnLuut.tsx` and `SellerRegistration.tsx` | `New Seller Request – {name/business}` |
| 3 | New customer signup | After successful `signUp` in `Login.tsx` | `New Customer Signup – {name or email}` |
| 4 | Seller account created (post-approval) | Already covered via #2; no separate event needed in current schema | — |
| 5 | Contact form | **Not present** (Contact page is WhatsApp only). Skipped — no infra needed. | — |
| 6 | Review submitted | After insert in `ReviewPopup.tsx` | `New Review – {rating}★ {product or general}` |
| 7 | Order status update needed | When customer cancels in `OrderDetails.tsx` (cancellation event) | `Order Cancelled – {orderNumber}` |
| 8 | Payment issue | Custom checkout uses Pay-on-Meetup (no online payment). Function structure prepared but no trigger wired (project has no payment-fail point). | `Payment Issue – {orderNumber}` (unused for now) |
| 9 | Seller product submission | After `seller_products.insert` in `seller/SellerProducts.tsx` | `New Product Submission – {product name}` |
| 10 | Low stock alert | After `rpc_mark_completed` returns success in `usePartnerOperations.ts` — check resulting partner stock; if ≤ 3 left, fire alert | `Low Stock Alert – {product name}` |
| 11 | Account-related issue | Skipped — Supabase auth handles failed logins; no usable hook in current codebase | — |
| 12 | General admin events | Covered by the above; no extras to avoid spam | — |

### Files

**New**
- `supabase/functions/send-admin-alert/index.ts` — Single dispatcher with templates for each `type`
- `supabase/config.toml` — Add `[functions.send-admin-alert]` with `verify_jwt = false`

**Edited (small, additive — fire-and-forget invokes only, no logic changes)**
- `src/pages/Login.tsx` — after signUp success → invoke `send-admin-alert` (`customer_signup`)
- `src/pages/SellOnLuut.tsx` — after `seller_applications.insert` success → invoke (`seller_application`)
- `src/pages/SellerRegistration.tsx` — after insert success → invoke (`seller_application`)
- `src/components/ReviewPopup.tsx` — after `reviews.insert` success → invoke (`review_submitted`)
- `src/pages/seller/SellerProducts.tsx` — after `seller_products.insert` success → invoke (`seller_product`)
- `src/pages/OrderDetails.tsx` — after customer cancel succeeds → invoke (`order_status_change`)
- `src/hooks/usePartnerOperations.ts` — after `rpc_mark_completed` success, query updated `partner_stock`; if any item ≤3 → invoke (`low_stock`)

### Email Design Standards
- Reuses the existing black-header / gold-accent / white-body template style from `send-merchant-order-email`
- Mobile-first: 600px max width, single-column tables, large tap targets
- Each alert has: title row, key fields in a 2-column table, optional CTA button to relevant admin page (e.g., `/admin/sellers`, `/admin/reviews`, `/admin/products`)
- No images, no extra fluff — under 5 fields per email

### Safety / Reliability
- `RESEND_API_KEY` already configured — no secrets needed
- Failed sends log `console.error` only, return 200 to caller, never throw
- All client-side invokes wrapped in `.catch(() => {})` so UI never breaks
- Resend test-mode caveat noted: while in test mode all emails route to `usual.suspect.118@gmail.com` (which is the admin anyway, so all alerts will deliver)

### Out of Scope (explicitly noted)
- Contact form alerts (no form exists)
- Failed-login alerts (no hook point)
- Online payment-failure alerts (Pay-on-Meetup model — no online payments)
- Skeleton structure for `payment_issue` is included in the dispatcher so it can be wired later without rebuild

