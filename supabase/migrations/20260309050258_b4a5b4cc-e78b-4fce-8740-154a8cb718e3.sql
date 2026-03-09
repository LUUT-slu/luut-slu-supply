CREATE POLICY "Admins can view all customer profiles"
ON public.customer_profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));