-- Add enhanced columns to seller_profiles
ALTER TABLE public.seller_profiles
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS shop_description text,
ADD COLUMN IF NOT EXISTS categories text[],
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS instagram_url text;

-- Create seller_products table
CREATE TABLE public.seller_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  location text,
  description text,
  images text[] DEFAULT '{}',
  category text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  views_count integer NOT NULL DEFAULT 0,
  clicks_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on seller_products
ALTER TABLE public.seller_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seller_products
CREATE POLICY "Sellers can view own products"
ON public.seller_products
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.seller_profiles sp
    WHERE sp.id = seller_products.seller_id
    AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all products"
ON public.seller_products
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active products"
ON public.seller_products
FOR SELECT
USING (status = 'active');

CREATE POLICY "Sellers can insert own products"
ON public.seller_products
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.seller_profiles sp
    WHERE sp.id = seller_products.seller_id
    AND sp.user_id = auth.uid()
    AND sp.is_approved = true
  )
);

CREATE POLICY "Sellers can update own products"
ON public.seller_products
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.seller_profiles sp
    WHERE sp.id = seller_products.seller_id
    AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Sellers can delete own products"
ON public.seller_products
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.seller_profiles sp
    WHERE sp.id = seller_products.seller_id
    AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all products"
ON public.seller_products
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at on seller_products
CREATE TRIGGER update_seller_products_updated_at
BEFORE UPDATE ON public.seller_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create order_items table for better seller attribution
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.seller_products(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES public.seller_profiles(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_image_url text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_items
CREATE POLICY "Sellers can view own order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.seller_profiles sp
    WHERE sp.id = order_items.seller_id
    AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all order items"
ON public.order_items
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Order items viewable with order token"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
    AND o.order_token IS NOT NULL
  )
);

CREATE POLICY "Anyone can insert order items"
ON public.order_items
FOR INSERT
WITH CHECK (true);

-- Create storage bucket for seller logos and product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-assets', 'seller-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for seller-assets bucket
CREATE POLICY "Anyone can view seller assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'seller-assets');

CREATE POLICY "Authenticated users can upload to seller-assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'seller-assets' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update own seller assets"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'seller-assets'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete own seller assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'seller-assets'
  AND auth.uid() IS NOT NULL
);

-- Allow admins to delete seller profiles
CREATE POLICY "Admins can delete seller profiles"
ON public.seller_profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));