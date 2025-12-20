-- Drop the security definer view and recreate as regular view with security_invoker
DROP VIEW IF EXISTS public.weekly_best_sellers;

CREATE VIEW public.weekly_best_sellers 
WITH (security_invoker = true) AS
SELECT 
  product_id,
  product_title,
  product_handle,
  product_image_url,
  SUM(quantity) as total_sold,
  MIN(price_amount) as price,
  MIN(currency_code) as currency_code
FROM public.product_sales
WHERE sold_at >= date_trunc('week', now())
GROUP BY product_id, product_title, product_handle, product_image_url
ORDER BY total_sold DESC
LIMIT 10;