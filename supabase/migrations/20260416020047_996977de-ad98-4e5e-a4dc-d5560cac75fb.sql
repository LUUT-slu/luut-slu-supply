
ALTER TABLE public.reviews
  ADD COLUMN product_handle text,
  ADD COLUMN product_title text;

CREATE INDEX idx_reviews_product_handle ON public.reviews (product_handle) WHERE product_handle IS NOT NULL;
