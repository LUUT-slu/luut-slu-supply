-- Drop overly permissive public view policy
DROP POLICY IF EXISTS "Anyone can view product sales" ON public.product_sales;

-- Drop existing seller policy to recreate with proper restrictions
DROP POLICY IF EXISTS "Sellers can view own sales" ON public.product_sales;

-- Sellers can only view their own sales (not null seller_user_id)
CREATE POLICY "Sellers can view own sales"
ON public.product_sales FOR SELECT
USING (auth.uid() = seller_user_id);

-- Admins can view all sales
CREATE POLICY "Admins can view all sales"
ON public.product_sales FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));