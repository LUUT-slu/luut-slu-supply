
ALTER TABLE public.promotion_campaigns
  ADD COLUMN IF NOT EXISTS target_mode text NOT NULL DEFAULT 'products',
  ADD COLUMN IF NOT EXISTS target_collections text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS badge_text text,
  ADD COLUMN IF NOT EXISTS banner_text text,
  ADD COLUMN IF NOT EXISTS cta_url text,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exclude_product_ids text[] NOT NULL DEFAULT '{}';
