
ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS main_category text,
  ADD COLUMN IF NOT EXISTS sub_category text;

CREATE INDEX IF NOT EXISTS idx_seller_products_main_category
  ON public.seller_products (main_category);

CREATE INDEX IF NOT EXISTS idx_seller_products_sub_category
  ON public.seller_products (sub_category);
