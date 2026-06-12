
DROP POLICY IF EXISTS "Authenticated users can insert admin logs" ON public.admin_logs;
CREATE POLICY "Admins can insert admin logs" ON public.admin_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can insert alert logs" ON public.admin_alert_logs;
CREATE POLICY "Admins can insert alert logs" ON public.admin_alert_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view active sellers" ON public.verified_sellers;
CREATE POLICY "Public can view active sellers" ON public.verified_sellers
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all sellers" ON public.verified_sellers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
