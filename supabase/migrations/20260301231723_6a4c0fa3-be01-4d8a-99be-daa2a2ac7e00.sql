-- Insert color_variant_cards setting with default config
INSERT INTO public.site_settings (id, value, updated_at)
VALUES (
  'color_variant_cards',
  '{"enabled": false, "showOnlyInStock": true}'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;