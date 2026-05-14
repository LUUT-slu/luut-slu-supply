ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url text,
  ADD COLUMN IF NOT EXISTS favorite_categories text[] DEFAULT '{}'::text[];