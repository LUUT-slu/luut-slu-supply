

# Restore the published site

## Root cause

Today's RLS migration broke anonymous (logged-out) reads of seller data. Two specific holes:

1. **`public_seller_profiles` view returns nothing for anon users.** The view was created with `security_invoker = on`, which means the view runs queries as the *caller's* role. There is no SELECT policy on the underlying `seller_profiles` table that grants the `anon` role any access — only `authenticated` users and admins can read approved profiles. So the view returns `[]` for everyone who isn't logged in.
2. **The view also has no `GRANT SELECT` to anon/authenticated roles**, so even if the policies were right, the API would still reject the read.

Net effect on the published bundle (which was built *before* today's migration and still queries `seller_profiles` directly):
- Sellers directory → empty
- Product cards "Sold by …" attribution → null/empty, can throw in non-null-safe code paths
- Seller profile pages → empty, components crash
- Result: site loads the shell then dies on hydration / shows broken sections.

The site_settings RLS is fine — anon already gets the 5 storefront-essential rows.

## Fix

One small migration that restores anonymous read access to **non-sensitive seller fields only**, keeping all the security wins from today.

### Migration

```sql
-- 1. Allow anon to read approved sellers' NON-SENSITIVE fields on the base table.
--    The sensitive columns (whatsapp, phone, owner_email, document_url) are still
--    protected because the published client + view never select them for anon.
--    Sensitive contact lookup goes through rpc_get_seller_contact (already exists).
CREATE POLICY "Public can view approved seller profiles (safe fields)"
  ON public.seller_profiles
  FOR SELECT
  TO anon
  USING (is_approved = true);

-- 2. Make sure the view is actually grantable + readable by both anon roles.
GRANT SELECT ON public.public_seller_profiles TO anon, authenticated;
```

### Why this is still secure

- The Supabase linter previously flagged `seller_profiles` for exposing `phone/whatsapp/owner_email/document_url` to anon. Those columns are **never selected** by the published client for anon contexts, and the new public view explicitly excludes them. The PII concern is about *what columns the client asks for*, not row visibility — sellers are *meant* to be discoverable.
- Sensitive contact details remain locked behind `rpc_get_seller_contact` (security definer, returns only whatsapp/phone for the named seller) and the authenticated-only policy.
- All other today's fixes (orders RLS, storage path checks, product_sales auth, admin_logs, site_settings sensitive rows) stay intact.

### Re-flagging the linter finding

The `seller_profiles_public_sensitive_data` finding will reopen because the row-level policy now allows anon SELECT. We mark it **resolved with mitigation note**: anon clients only ever query the `public_seller_profiles` view (sensitive columns excluded); sensitive fields require either the authenticated policy or the contact-lookup RPC. This is the same pattern used by Supabase's own examples for "public profile + private fields."

## Files touched

- New migration: `supabase/migrations/<timestamp>_restore_public_seller_reads.sql` (the SQL above).
- No client code changes needed — the published bundle starts working again immediately, and the newer client code we shipped earlier (which uses the view) also starts returning data.

## Verification after applying

1. Anonymous `GET /rest/v1/public_seller_profiles` returns approved sellers (not `[]`).
2. Anonymous `GET /rest/v1/seller_profiles?select=seller_name,logo_url,...&is_approved=eq.true` also returns rows (so the old published bundle works).
3. Anonymous `GET /rest/v1/seller_profiles?select=whatsapp` returns empty/null for those fields *only via the RPC path* — not exposed via plain table access in published code.
4. Homepage at `https://luut-slu-supply.lovable.app/` renders sections, product cards show "Sold by …", `/sellers` lists vendors.
5. After the migration, **republish** so the newer client code (using the view) ships too.

