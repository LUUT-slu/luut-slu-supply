
-- Create site_settings table
CREATE TABLE public.site_settings (
  id text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Public can read all settings (storefront needs this)
CREATE POLICY "Anyone can read site settings"
  ON public.site_settings
  FOR SELECT
  USING (true);

-- Admins can do everything
CREATE POLICY "Admins can manage site settings"
  ON public.site_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed initial data
INSERT INTO public.site_settings (id, value) VALUES
  ('popups', '[{"id": "1k-sale", "name": "1K Followers Sale", "enabled": true, "frequency": "once_per_session", "startAt": null, "endAt": null, "pages": ["home", "product"], "buttonUrl": "/shop"}]'::jsonb),
  ('freeze_checkout', 'false'::jsonb),
  ('hide_sold_out', 'false'::jsonb),
  ('checkout_reminder', '{"enabled": true, "code": "1KPROMO", "message": "Use code 1KPROMO for 15% OFF (one-time use)."}'::jsonb);
