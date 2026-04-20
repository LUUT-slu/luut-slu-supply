
CREATE TABLE IF NOT EXISTS public.admin_alert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  recipient text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_alert_logs_created_at ON public.admin_alert_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alert_logs_type ON public.admin_alert_logs (alert_type);

ALTER TABLE public.admin_alert_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view alert logs"
  ON public.admin_alert_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert alert logs"
  ON public.admin_alert_logs
  FOR INSERT
  WITH CHECK (true);
