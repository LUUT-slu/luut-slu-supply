-- Create seller_applications table for tracking seller requests
CREATE TABLE public.seller_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  location TEXT,
  categories TEXT[], -- Array of categories they want to sell
  proof_url TEXT, -- Optional proof/portfolio link
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'banned')),
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on seller_applications
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view own applications"
ON public.seller_applications FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own application
CREATE POLICY "Users can create own application"
ON public.seller_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.seller_applications FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update applications
CREATE POLICY "Admins can update applications"
ON public.seller_applications FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete applications
CREATE POLICY "Admins can delete applications"
ON public.seller_applications FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add approval tracking fields to seller_profiles
ALTER TABLE public.seller_profiles 
ADD COLUMN IF NOT EXISTS seller_status TEXT DEFAULT 'pending' CHECK (seller_status IN ('pending', 'approved', 'rejected', 'banned')),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS is_primary_seller BOOLEAN DEFAULT false;

-- Update existing approved sellers to have 'approved' status
UPDATE public.seller_profiles SET seller_status = 'approved' WHERE is_approved = true;
UPDATE public.seller_profiles SET seller_status = 'pending' WHERE is_approved = false;

-- Allow admins to update seller profiles (add if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'seller_profiles' AND policyname = 'Admins can update seller profiles'
  ) THEN
    CREATE POLICY "Admins can update seller profiles"
    ON public.seller_profiles FOR UPDATE
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Allow admins to view all seller profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'seller_profiles' AND policyname = 'Admins can view all seller profiles'
  ) THEN
    CREATE POLICY "Admins can view all seller profiles"
    ON public.seller_profiles FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Create updated_at trigger for seller_applications
CREATE OR REPLACE FUNCTION public.update_seller_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_seller_applications_updated_at
BEFORE UPDATE ON public.seller_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_seller_applications_updated_at();