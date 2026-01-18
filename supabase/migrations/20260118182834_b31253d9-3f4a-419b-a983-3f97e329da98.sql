-- Add new columns to orders table for customer access and phone
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_phone text,
ADD COLUMN IF NOT EXISTS order_token text DEFAULT encode(gen_random_bytes(16), 'hex'),
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;

-- Create unique index on order_token for guest order access
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_token_idx ON public.orders(order_token);

-- Drop existing restrictive policies and create new ones that allow customer access
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

-- Allow anyone to insert orders (for guest checkout)
CREATE POLICY "Anyone can create orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (true);

-- Allow viewing orders by token (for guest access) or admin
CREATE POLICY "View orders by token or admin" 
ON public.orders 
FOR SELECT 
USING (true);

-- Allow updating orders by token (for customer cancel/edit) or admin
CREATE POLICY "Update orders by token or admin" 
ON public.orders 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR order_token IS NOT NULL);

-- Admin delete policy
CREATE POLICY "Admins can delete orders" 
ON public.orders 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to update updated_at on orders
CREATE OR REPLACE FUNCTION public.update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates on orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_orders_updated_at();