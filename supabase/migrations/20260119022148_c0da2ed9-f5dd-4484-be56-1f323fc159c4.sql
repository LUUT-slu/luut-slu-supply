-- Add shopify_product_id column to seller_products for tracking synced products
ALTER TABLE public.seller_products 
ADD COLUMN IF NOT EXISTS shopify_product_id text UNIQUE;