
ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS owner_first_name text;
ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS owner_email text;
ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS facebook_url text;
