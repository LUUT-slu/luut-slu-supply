

# Lock down 5 critical RLS holes

Five `error`-level findings allow anonymous users to read/modify other people's data. Plan fixes the database side and patches the small number of client paths that depend on the loose policies.

## 1. `orders` — public SELECT and UPDATE

**Problem:** SELECT uses `USING (true)` and UPDATE uses `OR (order_token IS NOT NULL)`, so anyone can read or update every order.

**Fix (migration):**
- Drop `View orders by token or admin` and `Update orders by token or admin`.
- Add SELECT policy: admins, the assigned partner, the customer (`auth.uid() = customer_user_id`), and sellers (`is_seller_for_order(id)`) only.
- Add UPDATE policy with the same scope (admin/partner/seller).
- Public token-based access moves to a SECURITY DEFINER RPC that requires the matching `order_token`:
  - `rpc_get_order_by_token(p_order_id uuid, p_token text)` → returns order row only if token matches.
  - `rpc_update_order_by_token(p_order_id uuid, p_token text, p_location text, p_preferred_date text, p_note text, p_action text)` → handles the customer "edit / cancel" flow currently exposed in `OrderStatus.tsx` and `update-order` edge function.

**Client patches:**
- `src/pages/MyOrders.tsx` — currently reads orders by ID list from `localStorage`. Switch to fetching each order through the token RPC (token is already saved alongside the ID in the order-creation flow; if not, store it then). Falls back to "sign in to view your orders" if no token.
- `src/pages/OrderStatus.tsx` — replace direct `from("orders").select` with `rpc("rpc_get_order_by_token", ...)`.
- `src/pages/OrderDetails.tsx` — same swap.
- `supabase/functions/update-order/index.ts` — already validates token server-side with the service role; no change needed (service role bypasses RLS).
- Authenticated customers (`customer_user_id = auth.uid()`) keep direct read access via the new policy, so logged-in users still see their orders even without a token.

## 2. `seller_profiles` — full PII publicly readable

**Problem:** `Anyone can lookup seller by seller_id` uses `USING (true)`, exposing WhatsApp, phone, owner_email, document_url for every seller.

**Fix (migration):**
- Drop the `USING (true)` policy.
- Create a `public_seller_profiles` view (`security_invoker = on`) selecting only public fields: `id, seller_id, seller_name, logo_url, shop_description, location, categories, is_approved, is_primary_seller, instagram_url, facebook_url, created_at`. Excludes phone/whatsapp/owner_email/document_url.
- New policy on base table: public SELECT only when `is_approved = true` AND only via the view (base table denies anon by default; admins + owner keep existing direct policies).
- Simpler approach actually used: keep base table SELECT restricted to admin + owner, and grant `SELECT` on the view to `anon, authenticated`. The view inherits permissions but excludes sensitive columns.
- Sensitive contact info (whatsapp/phone) needed by `Checkout.tsx` for seller routing: move that lookup into a SECURITY DEFINER function `rpc_get_seller_contact(p_seller_name text)` that returns only `whatsapp` + `phone` for an approved seller. Called from checkout flow.

**Client patches:**
- `src/pages/Checkout.tsx` line 347 — swap `.from('seller_profiles').select('whatsapp, phone')` for `.rpc('rpc_get_seller_contact', { p_seller_name: vendorName })`.
- All other public reads (`Sellers.tsx`, `SellerProfile.tsx`, product cards) switch `.from("seller_profiles")` → `.from("public_seller_profiles")` for anon contexts. Owner/admin code paths unchanged.

## 3. `seller-assets` storage — any user can update/delete others' files

**Problem:** UPDATE/DELETE policies only check `auth.uid() IS NOT NULL`. The codebase uses three folder conventions: `products/`, `logos/`, `reviews/`, `homepage/` — none prefixed with userId.

**Fix (migration):**
- Drop existing UPDATE/DELETE policies.
- Add restrictive replacements:
  - **`logos/`**: filename starts with `{userId}-logo-` → `name LIKE 'logos/' || auth.uid()::text || '-logo-%'`.
  - **`products/`**: filename starts with `{sellerProfileId}-` and the caller owns that seller profile → check via `EXISTS (SELECT 1 FROM seller_profiles WHERE user_id = auth.uid() AND name LIKE 'products/' || id::text || '-%')`.
  - **`reviews/`** and **`homepage/`**: admin-only UPDATE/DELETE.
- INSERT policy stays open for authenticated users but adds the same path validation.

**Client patches:** none — existing upload paths already follow these conventions.

## 4. `product_sales` — anonymous inserts allowed

**Problem:** `WITH CHECK (true)` lets anyone fabricate sales rows.

**Fix (migration):**
- Drop `Anyone can insert product sales`.
- Add `Authenticated sellers can insert own sales` with `WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = seller_user_id)`.

**Client patches:** confirm callers (likely `ProductDetail.tsx` purchase tracking) pass `seller_user_id = auth.uid()`. If any anonymous insert path exists, route it through the existing `create-order` edge function (service role) instead.

## 5. Verification

After migration:
- Run the Supabase linter to confirm the five `error`-level findings clear.
- Mark each finding fixed via the security tool with the SQL/code summary.
- Smoke-test: guest checkout → order created → customer sees order via token link; seller sees own products in dashboard; sellers directory still lists approved vendors without leaking phone numbers.

## Files touched

**New migration** (one file, all five fixes):
- Drops + recreates the 5 policies above
- Creates `public_seller_profiles` view
- Creates `rpc_get_order_by_token`, `rpc_update_order_by_token`, `rpc_get_seller_contact`

**Code edits:**
- `src/pages/MyOrders.tsx`
- `src/pages/OrderStatus.tsx`
- `src/pages/OrderDetails.tsx`
- `src/pages/Checkout.tsx`
- Any anon-context reads of `seller_profiles` switched to `public_seller_profiles` (Sellers.tsx, SellerProfile.tsx, product card hooks — exact list confirmed during implementation)

No UX changes; only the underlying queries shift.

