-- Allow admins to insert seller profiles (for approval flow)
CREATE POLICY "Admins can insert seller profiles"
ON public.seller_profiles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));