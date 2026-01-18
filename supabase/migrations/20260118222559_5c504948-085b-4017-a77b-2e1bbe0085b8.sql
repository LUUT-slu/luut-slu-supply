-- First create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create a partners table to store partner info
CREATE TABLE IF NOT EXISTS public.partner_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    partner_name text NOT NULL,
    phone text,
    whatsapp text,
    location text,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add new columns to orders table for Luut Connect
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS assigned_partner_id uuid,
ADD COLUMN IF NOT EXISTS pickup_time_window text,
ADD COLUMN IF NOT EXISTS customer_user_id uuid;

-- Enable RLS on partner_profiles
ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for partner_profiles
CREATE POLICY "Admins can view all partners"
ON public.partner_profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can view own profile"
ON public.partner_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can register as partner"
ON public.partner_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Partners can update own profile"
ON public.partner_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any partner"
ON public.partner_profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete partners"
ON public.partner_profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update orders RLS to allow partners to see their assigned orders
CREATE POLICY "Partners can view assigned orders"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = assigned_partner_id);

CREATE POLICY "Partners can update assigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = assigned_partner_id);

-- Create trigger for partner_profiles updated_at
CREATE TRIGGER update_partner_profiles_updated_at
BEFORE UPDATE ON public.partner_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check if user is a partner
CREATE OR REPLACE FUNCTION public.is_partner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.partner_profiles
    WHERE user_id = _user_id
      AND is_active = true
  )
$$;