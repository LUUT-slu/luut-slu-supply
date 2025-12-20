-- Create admin_logs table for tracking admin logins
CREATE TABLE public.admin_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (edge function will handle this)
CREATE POLICY "Anyone can insert admin logs"
ON public.admin_logs
FOR INSERT
WITH CHECK (true);

-- Allow reading logs (for admin dashboard)
CREATE POLICY "Anyone can view admin logs"
ON public.admin_logs
FOR SELECT
USING (true);

-- Create verified_sellers table
CREATE TABLE public.verified_sellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  location TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.verified_sellers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active sellers
CREATE POLICY "Anyone can view active sellers"
ON public.verified_sellers
FOR SELECT
USING (true);

-- Allow all operations (admin manages via UI)
CREATE POLICY "Anyone can insert sellers"
ON public.verified_sellers
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update sellers"
ON public.verified_sellers
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can delete sellers"
ON public.verified_sellers
FOR DELETE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_verified_sellers_updated_at
BEFORE UPDATE ON public.verified_sellers
FOR EACH ROW
EXECUTE FUNCTION public.update_orders_updated_at();