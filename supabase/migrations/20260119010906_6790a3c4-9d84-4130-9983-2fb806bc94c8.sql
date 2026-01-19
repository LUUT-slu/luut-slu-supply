-- Add commission tracking columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS partner_commission numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS partner_commission_status text DEFAULT 'pending';

-- Add comment for documentation
COMMENT ON COLUMN public.orders.partner_commission IS 'Commission amount assigned to partner for this order';
COMMENT ON COLUMN public.orders.partner_commission_status IS 'Status of commission: pending, locked, paid';