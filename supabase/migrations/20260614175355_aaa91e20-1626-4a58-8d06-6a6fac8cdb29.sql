-- Storage policies for marketing-assets bucket
CREATE POLICY "Admins can upload marketing assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'marketing-assets'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can read marketing assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'marketing-assets'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete marketing assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'marketing-assets'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Generated marketing images registry
CREATE TABLE IF NOT EXISTS public.marketing_generated_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  image_url text NOT NULL,
  thumbnail_url text,
  generation_type text NOT NULL,
  product_title text,
  product_handle text,
  style text,
  aspect_ratio text,
  prompt_used text,
  reference_image_url text,
  logo_applied boolean DEFAULT false,
  logo_position text,
  created_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_generated_images TO authenticated;
GRANT ALL ON public.marketing_generated_images TO service_role;

ALTER TABLE public.marketing_generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage generated images"
  ON public.marketing_generated_images FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS marketing_generated_images_created_at_idx
  ON public.marketing_generated_images (created_at DESC);

CREATE INDEX IF NOT EXISTS marketing_generated_images_type_idx
  ON public.marketing_generated_images (generation_type, created_at DESC);
