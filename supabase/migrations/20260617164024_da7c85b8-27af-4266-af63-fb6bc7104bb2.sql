ALTER TABLE public.marketing_generated_images
  ADD COLUMN IF NOT EXISTS campaign_type text,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS marketing_generated_images_favorite_idx
  ON public.marketing_generated_images (is_favorite, created_at DESC);