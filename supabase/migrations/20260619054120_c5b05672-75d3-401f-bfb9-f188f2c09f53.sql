
REVOKE SELECT (phone, whatsapp) ON public.verified_sellers FROM authenticated;

DROP POLICY IF EXISTS "Owners insert own POs" ON public.purchase_orders;
CREATE POLICY "Owners insert own POs"
ON public.purchase_orders
FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());
