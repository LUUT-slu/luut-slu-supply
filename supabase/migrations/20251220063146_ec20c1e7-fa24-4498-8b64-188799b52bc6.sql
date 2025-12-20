-- Allow anyone to look up a seller profile by seller_id (needed for ID-based login)
CREATE POLICY "Anyone can lookup seller by seller_id"
ON public.seller_profiles
FOR SELECT
USING (true);