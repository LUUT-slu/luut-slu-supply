-- Drop public view policy
DROP POLICY IF EXISTS "Anyone can view admin logs" ON public.admin_logs;

-- Create admin-only view policy
CREATE POLICY "Admins can view admin logs"
ON public.admin_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));