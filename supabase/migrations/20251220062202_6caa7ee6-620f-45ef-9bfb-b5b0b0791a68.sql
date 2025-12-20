-- Create seller profiles table linked to auth.users
CREATE TABLE public.seller_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_name TEXT NOT NULL,
  whatsapp TEXT,
  location TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own profile
CREATE POLICY "Sellers can view own profile"
ON public.seller_profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Sellers can update their own profile
CREATE POLICY "Sellers can update own profile"
ON public.seller_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Anyone can insert (for registration)
CREATE POLICY "Anyone can register as seller"
ON public.seller_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add seller_user_id to product_sales for tracking which seller made the sale
ALTER TABLE public.product_sales 
ADD COLUMN seller_user_id UUID REFERENCES auth.users(id);

-- Allow sellers to view their own sales
CREATE POLICY "Sellers can view own sales"
ON public.product_sales
FOR SELECT
USING (seller_user_id = auth.uid() OR seller_user_id IS NULL);

-- Update trigger for seller_profiles
CREATE TRIGGER update_seller_profiles_updated_at
BEFORE UPDATE ON public.seller_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_orders_updated_at();