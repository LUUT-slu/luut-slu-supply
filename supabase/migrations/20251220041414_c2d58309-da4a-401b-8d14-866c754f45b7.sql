-- Create a table to track product sales
CREATE TABLE public.product_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  product_handle TEXT NOT NULL,
  product_image_url TEXT,
  variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_amount DECIMAL(10,2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'XCD',
  sold_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for weekly aggregation queries
CREATE INDEX idx_product_sales_sold_at ON public.product_sales(sold_at);
CREATE INDEX idx_product_sales_product_id ON public.product_sales(product_id);

-- Enable Row Level Security
ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read sales data (for displaying best sellers)
CREATE POLICY "Anyone can view product sales" 
ON public.product_sales 
FOR SELECT 
USING (true);

-- Allow inserting sales records (from checkout tracking)
CREATE POLICY "Anyone can insert product sales" 
ON public.product_sales 
FOR INSERT 
WITH CHECK (true);

-- Create a view for weekly best sellers
CREATE OR REPLACE VIEW public.weekly_best_sellers AS
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