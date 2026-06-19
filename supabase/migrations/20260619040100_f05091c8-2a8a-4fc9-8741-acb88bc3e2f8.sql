-- verified_sellers: remove authenticated browse access (admins still have full access)
DROP POLICY IF EXISTS "Authenticated users can view active sellers" ON public.verified_sellers;
REVOKE SELECT ON public.verified_sellers FROM authenticated;

-- site_settings: restrict authenticated reads to the storefront allowlist
DROP POLICY IF EXISTS "Authenticated users can read all site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public can read storefront settings" ON public.site_settings;

CREATE POLICY "Anyone can read storefront settings"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (id = ANY (ARRAY[
  'popups'::text,
  'hide_sold_out'::text,
  'color_variant_cards'::text,
  'homepage_layout'::text,
  'freeze_checkout'::text,
  'checkout_reminder'::text
]));