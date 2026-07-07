## Goal

Every order auto-creates a claimable "shadow" customer keyed by phone. Customer claims via a per-customer link + phone confirmation, then gets a persistent session showing order history, live stock, and eligible discounts. Admin has a page to view and blast claim links to all unclaimed customers.

## Security model (locked in)

- **Primary factor:** unguessable per-customer `claim_token` (32-byte URL-safe), sent by you via WhatsApp.
- **Confirmation:** customer types their phone; must match (normalized) the phone on the shadow profile the token points to.
- **Rate limit:** max 5 wrong phone attempts per token per 15 min → token locked for 1 hour; admin can reset. Attempts logged.
- **Session:** after successful claim, we issue a long-lived Supabase session for that user (persisted, auto-refresh). Device stays signed in.
- **New device:** re-open the same claim link → enter phone → new session. Token stays valid (per-customer, not per-device) until customer opts to add a stronger factor later.
- **Future-ready:** the confirmation step is a single isolated function (`verify-claim`). Swapping "phone equality" for "phone equality + SMS OTP" later is a 1-file change — no schema or UX rebuild.

## Database changes

1. **`customer_profiles` becomes claimable without an auth user.**
   - Make `user_id` nullable (drop NOT NULL, keep unique-when-present).
   - Add: `claim_token text unique`, `claim_token_issued_at timestamptz`, `claimed_at timestamptz`, `claim_attempts int default 0`, `claim_locked_until timestamptz`, `is_shadow boolean generated as (user_id is null)`.
   - Backfill `claim_token` for every existing profile whose phone has orders but no `user_id` (there shouldn't be any today, but safe).

2. **Order → profile linkage by phone** (already partly done in previous turn).
   - On every order insert (checkout + seller dashboard + Shopify sync), normalize phone and:
     - if a `customer_profiles` row exists for that phone → link `orders.customer_profile_id` (add column) and, if profile has `user_id`, also set `orders.customer_user_id`.
     - else → create a shadow profile (phone + name from order, `user_id = null`, fresh `claim_token`) and link it.
   - Handled in a `SECURITY DEFINER` function `public.ensure_customer_profile_for_order(phone, name)` called from the create-draft-order edge function and from a trigger for direct DB inserts.

3. **Claim on signup / login.**
   - Extend `handle_new_customer` trigger: when a new `auth.users` row appears, if a shadow profile exists with the same phone (from `raw_user_meta_data.phone` passed during claim), attach `user_id` to it instead of creating a new profile. Clear `claim_token`, set `claimed_at`.

4. **RLS.**
   - Shadow profiles readable only by `service_role` (never by anon/authenticated) — the claim edge function is the only public read path, and it goes by token.
   - Orders remain readable by owning `user_id`; after claim, the newly-attached `user_id` unlocks history automatically via existing policy.

5. **Attempt log table** `claim_attempts` (token, ip, ok, at) — for rate-limit tracking and audit.

## Edge functions

- **`issue-claim-link`** (admin-only): given a `customer_profile_id` or phone, mint/rotate a token, return `https://<site>/claim/<token>` + a prewritten WhatsApp message.
- **`verify-claim`** (public): input `{ token, phone }`.
  - Check token exists, not locked, not already claimed by another user.
  - Normalize both phones, compare.
  - On mismatch: increment attempts, lock after 5.
  - On match: create/sign-in an anonymous-linked Supabase user *bound to that phone*, run the trigger that attaches the shadow profile, return a session (access + refresh token) the client stores in Supabase auth.
  - Idempotent: if already claimed, and phone matches, just return a fresh session for the linked user.
- **`admin-list-unclaimed`** (admin-only): paginated list of shadow profiles with phone, name, order count, last order date, claim URL; CSV export endpoint.

## Frontend

- **`/claim/:token`** page:
  - Step 1: phone input (autofocus, tel keyboard, normalized on submit).
  - Step 2 (after verify): success screen → auto-redirect to `/account`.
  - Handles locked/expired token states with a "message Luut on WhatsApp" fallback.
- **`/account`** (existing customer dashboard, if present — otherwise minimal new page):
  - Order history (already-wired queries just work once `user_id` is attached).
  - "Browse current stock" CTA → `/shop`.
  - "Your discounts" section listing rows from `customer_discounts` for this user.
- **Admin → Unclaimed Customers** page under existing admin area:
  - Table: phone, name, #orders, last order, claim link (copy button), WhatsApp button (opens wa.me with prewritten message + link), "reset lock" action.
  - "Export CSV" and "Copy all as WhatsApp broadcast" (one message per customer, tab-separated).
  - Per-order "Send claim link" button on the admin order detail view.

## Session persistence

- Supabase client is already configured with `persistSession: true` / `autoRefreshToken: true` (default). After `verify-claim` returns tokens, call `supabase.auth.setSession(...)` on the client — user stays signed in across reloads and days until they log out.

## Forward compatibility with SMS OTP

- `verify-claim` is the single choke point. Adding SMS later = enable Supabase phone auth, and inside `verify-claim` replace the phone-equality branch with "send OTP → second call with code → then issue session." Token, shadow-profile model, claim URL, admin page, and `/claim/:token` UI all stay identical.

## Out of scope for this pass

- Actual SMS provider wiring (planned ~2 weeks out per your note).
- Merging two shadow profiles that end up on the same phone due to legacy dirty data — handled by the unique phone index; migration will dedupe by keeping the oldest and re-pointing orders.

## Technical notes

- Phone normalization uses the shared `normalize_phone` SQL function + `_shared/phone.ts` already added.
- Tokens: `crypto.randomUUID()` is not enough entropy for a bearer secret — use `crypto.getRandomValues(new Uint8Array(32))` → base64url.
- Rate-limit counter is per-token, stored on the profile row; `claim_attempts` table is for forensics, not the gate.
- Admin auth for the two admin functions uses existing `has_role(auth.uid(), 'admin')`.
