
-- Category images table
CREATE TABLE IF NOT EXISTS public.category_images (
  category_key text PRIMARY KEY,
  main_slug text NOT NULL,
  sub_slug text,
  display_name text NOT NULL,
  image_url text,
  image_url_banner text,
  image_url_hero text,
  image_source text NOT NULL DEFAULT 'ai' CHECK (image_source IN ('ai','manual','shopify')),
  prompt_used text,
  prompt_override text,
  sample_titles jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  last_generated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.category_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view approved category images"
  ON public.category_images FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Admins can view all category images"
  ON public.category_images FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage category images"
  ON public.category_images FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_category_images_updated_at
  BEFORE UPDATE ON public.category_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-images', 'category-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read category images bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'category-images');

CREATE POLICY "Admins can upload category images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'category-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update category images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'category-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete category images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'category-images' AND has_role(auth.uid(), 'admin'::app_role));
