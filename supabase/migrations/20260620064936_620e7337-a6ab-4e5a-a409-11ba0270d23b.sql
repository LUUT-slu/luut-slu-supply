DROP POLICY IF EXISTS "Anyone can submit seller application" ON public.verified_sellers;
CREATE POLICY "Authenticated users can submit seller application"
ON public.verified_sellers
FOR INSERT
TO authenticated
WITH CHECK (is_active = false);