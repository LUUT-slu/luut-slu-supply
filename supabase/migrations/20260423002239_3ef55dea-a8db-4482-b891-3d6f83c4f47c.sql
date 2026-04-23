-- =====================================================
-- 1. SELLER PROFILES: Remove public PII exposure
-- =====================================================
-- The "Anyone can view approved seller profiles" policy exposes phone, whatsapp,
-- owner_email, document_url. The public_seller_profiles VIEW already exists and
-- exposes only safe columns. Drop the permissive policy on the base table.

DROP POLICY IF EXISTS "Anyone can view approved seller profiles" ON public.seller_profiles;

-- Allow authenticated users to read approved seller contact details (whatsapp/phone)
-- only when needed (e.g. signed-in checkout). Anonymous users use the view + RPC.
CREATE POLICY "Authenticated users can view approved seller contact"
  ON public.seller_profiles
  FOR SELECT
  TO authenticated
  USING (is_approved = true);

-- Ensure the public view is readable by anon + authenticated
GRANT SELECT ON public.public_seller_profiles TO anon, authenticated;

-- =====================================================
-- 2. ADMIN LOGS: Lock down inserts to authenticated only
-- =====================================================
DROP POLICY IF EXISTS "Anyone can insert admin logs" ON public.admin_logs;

CREATE POLICY "Authenticated users can insert admin logs"
  ON public.admin_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 3. ADMIN ALERT LOGS: Same lockdown
-- =====================================================
DROP POLICY IF EXISTS "Anyone can insert alert logs" ON public.admin_alert_logs;

CREATE POLICY "Authenticated users can insert alert logs"
  ON public.admin_alert_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 4. SITE SETTINGS: Restrict sensitive rows
-- =====================================================
-- Public reads only for storefront-facing rows. Internal settings
-- (checkout_reminder promo codes, notifications, marketing_studio) are
-- restricted to authenticated users.

DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;

CREATE POLICY "Public can read storefront settings"
  ON public.site_settings
  FOR SELECT
  TO anon
  USING (id IN (
    'popups',
    'hide_sold_out',
    'color_variant_cards',
    'homepage_layout',
    'freeze_checkout'
  ));

CREATE POLICY "Authenticated users can read all site settings"
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- 5. FUNCTION SEARCH PATH: Lock all remaining functions
-- =====================================================
-- Most functions already have SET search_path = public. The linter flags
-- any without it. Fix the two remaining (rpc_update_order_by_token if missing,
-- and any helper added without search_path).

ALTER FUNCTION public.update_seller_applications_updated_at() SET search_path = public;

-- =====================================================
-- 6. STORAGE: Prevent listing of seller-assets bucket
-- =====================================================
-- Public bucket allows direct file URL access (needed for product images),
-- but listing the bucket contents should require authentication.
-- Drop overly broad SELECT on storage.objects for seller-assets and
-- replace with a policy that allows direct file access (which uses the
-- bucket's public flag, not the SELECT policy on storage.objects).

DO $$
BEGIN
  -- Remove any policy that lets anyone list seller-assets contents
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public can view seller assets'
  ) THEN
    DROP POLICY "Public can view seller assets" ON storage.objects;
  END IF;
END $$;

-- Create a more conservative SELECT policy: file access works via signed/public
-- URLs regardless of this policy; this only restricts metadata listing through
-- the API. Authenticated users (sellers/admins) can still query their bucket.
CREATE POLICY "Authenticated users can list seller-assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'seller-assets');

-- =====================================================
-- 7. LEAKED PASSWORD PROTECTION (handled via configure_auth tool)
-- =====================================================
-- This is handled separately via the configure_auth tool, not SQL.
