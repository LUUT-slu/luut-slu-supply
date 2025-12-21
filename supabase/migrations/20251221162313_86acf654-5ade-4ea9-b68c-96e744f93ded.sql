-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can insert sellers" ON public.verified_sellers;
DROP POLICY IF EXISTS "Anyone can update sellers" ON public.verified_sellers;
DROP POLICY IF EXISTS "Anyone can delete sellers" ON public.verified_sellers;

-- Allow public to submit seller applications (must be inactive by default)
CREATE POLICY "Anyone can submit seller application"
ON public.verified_sellers FOR INSERT
WITH CHECK (is_active = false);

-- Only admins can update sellers
CREATE POLICY "Admins can update sellers"
ON public.verified_sellers FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete sellers
CREATE POLICY "Admins can delete sellers"
ON public.verified_sellers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));