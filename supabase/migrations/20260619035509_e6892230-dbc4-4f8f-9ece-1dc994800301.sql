DROP POLICY IF EXISTS "Public can view active sellers" ON public.verified_sellers;
CREATE POLICY "Authenticated users can view active sellers"
ON public.verified_sellers
FOR SELECT
TO authenticated
USING (is_active = true);
REVOKE SELECT ON public.verified_sellers FROM anon;
GRANT SELECT ON public.verified_sellers TO authenticated;