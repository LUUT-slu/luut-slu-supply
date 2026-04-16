
-- Create reviews table
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_name text,
  rating integer NOT NULL,
  comment text,
  image_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  show_on_homepage boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can insert reviews (public form)
CREATE POLICY "Anyone can submit reviews"
ON public.reviews FOR INSERT
WITH CHECK (true);

-- Anyone can view approved homepage reviews
CREATE POLICY "Anyone can view approved homepage reviews"
ON public.reviews FOR SELECT
USING (status = 'approved' AND show_on_homepage = true);

-- Admins can do everything
CREATE POLICY "Admins can manage all reviews"
ON public.reviews FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Validation trigger for comment length and rating range
CREATE OR REPLACE FUNCTION public.validate_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  IF length(NEW.comment) > 200 THEN
    RAISE EXCEPTION 'Comment must not exceed 200 characters';
  END IF;
  IF array_length(NEW.image_urls, 1) > 2 THEN
    RAISE EXCEPTION 'Maximum 2 images allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_review_before_insert
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_review();

-- Storage policy for review images in seller-assets bucket
CREATE POLICY "Anyone can upload review images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'seller-assets' AND (storage.foldername(name))[1] = 'reviews');
