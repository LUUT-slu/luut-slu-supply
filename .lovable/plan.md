## Current state (what's actually wired up)

**Shopify side — `supabase/functions/create-draft-order/index.ts` → `findOrCreateShopifyCustomer` (lines 61–173).** Already phone‑primary in intent: normalizes to E.164 via `normalizePhone`, searches `phone:<normalized>`, falls back to `email:<email>`, then creates. On a 422 duplicate it retries — but the retry sends the raw normalized number instead of `phone:<normalized>`, so it can miss. On a match it does NOT overwrite first/last name (correct — name typed this order is ignored). Good baseline; two rough edges to fix.

**Local side — same file, order insert at lines 346–366.** Order rows get `customer_name`, `customer_phone` (raw, as typed), `customer_email`. `orders.customer_user_id` exists in the schema and is used elsewhere (loyalty, admin customer view, `sync-shopify-orders` at line 299), but **`create-draft-order` never sets it**. So a returning customer who checks out as guest — or a seller‑dashboard order for a known number — is not linked to their existing `customer_profiles` row. Both customer_checkout and seller_dashboard paths share this insert.

**`customer_profiles.phone`** is stored as whatever was typed (no normalization). `handle_new_customer` trigger doesn't touch phone; `sync-shopify-customer` normalizes only when calling Shopify, not before writing the profile. That means a "match by phone" query today only works when the two strings happen to be identical.

**`supabase/functions/sync-shopify-orders/index.ts`** (line 247–259) resolves `customer_user_id` for Shopify‑originated orders by `email OR phone` against `customer_profiles`, but uses the raw phone from Shopify — will miss when stored profile phones aren't normalized to the same form.

## Goal restated

Normalized phone is the primary customer identity across the platform. Name typed on a given order is a per‑order label, never used for identity, never overwrites a stored name, and never blocks an order.

## Plan

### 1. One shared phone normalizer, applied everywhere phone is written or matched

Extract the existing `normalizePhone` (already duplicated in `create-draft-order` and `sync-shopify-customer`) into `supabase/functions/_shared/phone.ts` and import it from all three edge functions plus `sync-shopify-orders`. Same E.164 rules: 7 digits → `+1758…`, 10 → `+1…`, 11 starting `1` → `+…`, already `+` kept, else prefix `+`.

### 2. Normalize `customer_profiles.phone` at the DB layer

Migration:
- Add SQL helper `public.normalize_phone(text) returns text` implementing the same rules (immutable, safe for expression indexes).
- `BEFORE INSERT OR UPDATE OF phone` trigger on `customer_profiles` that sets `NEW.phone = normalize_phone(NEW.phone)`.
- One‑time backfill: `UPDATE customer_profiles SET phone = normalize_phone(phone) WHERE phone IS NOT NULL`.
- Partial unique index `CREATE UNIQUE INDEX customer_profiles_phone_unique ON customer_profiles (phone) WHERE phone IS NOT NULL` so we never accumulate duplicates going forward. (If backfill surfaces existing duplicates we'll merge oldest‑wins before adding the index; migration will detect and abort with a clear message if any remain.)

This is the only schema change in the plan.

### 3. Link every new order to `customer_profiles` by normalized phone

In `create-draft-order`, before the `orders` insert (around line 346):
1. `const normalizedPhone = normalizePhone(customerPhone)`.
2. Query `customer_profiles.select("user_id, full_name, email, shopify_customer_id").eq("phone", normalizedPhone).maybeSingle()`.
3. If a match is found:
   - Set `customer_user_id = profile.user_id` on the insert.
   - Store `customer_phone = normalizedPhone` (canonical), not the raw string.
   - Keep `customer_name` = whatever the caller typed (order label). **Do not** overwrite `customer_profiles.full_name`.
   - If `profile.shopify_customer_id` is set, pass it into `findOrCreateShopifyCustomer` as a fast‑path so we skip the Shopify search entirely.
4. If no match: still store the normalized phone; leave `customer_user_id` NULL (guest order).

Applies identically to `orderSource === 'customer_checkout'` and `'seller_dashboard'` because the insert is shared.

### 4. Harden `findOrCreateShopifyCustomer` (Shopify side)

Same file, lines 61–173:
- Accept an optional `knownShopifyCustomerId` param. When provided, skip search and return it. Powers the fast‑path from step 3.
- Query with the field prefix on **both** the normalized number and the last‑10 digits: `phone:<normalized> OR phone:<last10>`. Shopify's search index sometimes stores older records without the country code; this eliminates a whole class of false negatives that today force a new customer.
- Fix the 422 retry (line 157) to send `phone:<normalized>` (currently sends the bare number, which searches all fields and can miss).
- Keep the current behavior of never overwriting `first_name`/`last_name` on match. Only patch `phone` when missing/different. Explicitly, when the typed name differs from the stored Shopify name we log it and move on — no update, no error.
- If both search and create still fail (e.g. Shopify 401/5xx), keep today's "record failure, don't create draft" behavior. Not a regression, and the token issue is orthogonal.

### 5. Normalize before matching in `sync-shopify-orders`

Line 247–259: run the imported `normalizePhone` on `customer.phone` before the `.or("email.eq…,phone.eq…")` query. Ensures Shopify‑originated orders link back to the same local profile the checkout path uses.

### 6. Normalize on write in `sync-shopify-customer` and profile updates

`sync-shopify-customer/index.ts` and any place we write `customer_profiles.phone` from the app (Account Settings, phone prompt modal) should normalize before writing. The DB trigger from step 2 is a belt‑and‑braces safety net; keeping app code consistent avoids surprising the user with a "changed" phone value.

## Explicit non‑goals

- No changes to `customer_name` handling. The typed name always appears on that specific order; the profile's stored name is untouched.
- No new UI, no changes to auth, no changes to seller/vendor logic.
- No touching `orders.customer_phone` on already‑saved orders (out of scope for identity going forward).
- No merging of existing duplicate `customer_profiles` rows in this plan beyond what step 2's index requires; if duplicates block the unique index we'll surface a small merge report and address it as a follow‑up.

## Files touched

- New: `supabase/functions/_shared/phone.ts`
- Edited: `supabase/functions/create-draft-order/index.ts` (order insert block + `findOrCreateShopifyCustomer` signature/logic)
- Edited: `supabase/functions/sync-shopify-customer/index.ts` (import shared normalizer; normalize before profile write)
- Edited: `supabase/functions/sync-shopify-orders/index.ts` (normalize before profile lookup)
- New migration: `normalize_phone` function + trigger + backfill + unique index on `customer_profiles.phone`

## Verification after build

1. New guest checkout with a phone that matches an existing profile → resulting `orders` row has `customer_user_id` populated and `customer_phone` in E.164; no new Shopify customer created; existing Shopify first/last name unchanged even if a different name was typed.
2. Same but with a phone that has no match → order created, `customer_user_id` NULL, Shopify creates a new customer.
3. Seller‑dashboard order for a known phone with a deliberately mistyped name → order links to correct profile, no error, no duplicate Shopify customer.
4. `sync-shopify-orders` run after a POS sale from a known phone → local order links to the same profile.
